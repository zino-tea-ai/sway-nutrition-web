from __future__ import annotations

import math
import os
import time
import uuid
from functools import lru_cache
from io import BytesIO
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from rembg import new_session, remove
from starlette.concurrency import run_in_threadpool

try:
    import onnxruntime as ort
except Exception:  # pragma: no cover - optional diagnostics
    ort = None


DEFAULT_MODEL = os.getenv("VILO_CUTOUT_MODEL", "isnet-general-use")
MAX_UPLOAD_MB = float(os.getenv("VILO_MAX_UPLOAD_MB", "12"))
MAX_INPUT_PIXELS = int(os.getenv("VILO_MAX_INPUT_PIXELS", "9000000"))
ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("VILO_CORS_ORIGINS", "http://127.0.0.1:5188,http://localhost:5188").split(",")
    if origin.strip()
]
ALLOW_LOCAL_DEV_CORS = os.getenv("VILO_CORS_ALLOW_LOCAL_DEV", "1").strip().lower() in {"1", "true", "yes", "on"}
DEFAULT_LOCAL_ORIGIN_REGEX = r"^https?://(127\.0\.0\.1|localhost):\d+$" if ALLOW_LOCAL_DEV_CORS else ""
ALLOW_ORIGIN_REGEX = os.getenv("VILO_CORS_ORIGIN_REGEX", DEFAULT_LOCAL_ORIGIN_REGEX).strip() or None
if "*" in ALLOW_ORIGINS:
    ALLOW_ORIGINS = ["*"]
    ALLOW_ORIGIN_REGEX = None

MODEL_PRESETS: dict[str, dict[str, str]] = {
    "u2netp": {
        "tier": "fast",
        "notes": "Small preview model. Fastest cold start, weakest fine edges.",
    },
    "silueta": {
        "tier": "balanced",
        "notes": "Smaller U2Net-family model. Useful for low-cost production fallback.",
    },
    "isnet-general-use": {
        "tier": "quality",
        "notes": "General-purpose high accuracy model. Default for food/object stickers.",
    },
    "birefnet-general-lite": {
        "tier": "quality",
        "notes": "BiRefNet-lite general foreground model when available in rembg.",
    },
    "birefnet-general": {
        "tier": "max-quality",
        "notes": "Higher quality BiRefNet general model, heavier cold start and memory.",
    },
}


app = FastAPI(title="Vilo Cutout API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS or ["*"],
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=[
        "x-vilo-cutout-ms",
        "x-vilo-cutout-model",
        "x-vilo-input-pixels",
        "x-vilo-output-bytes",
        "x-vilo-request-id",
    ],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "defaultModel": DEFAULT_MODEL,
        "maxUploadMb": MAX_UPLOAD_MB,
        "maxInputPixels": MAX_INPUT_PIXELS,
        "corsOrigins": ALLOW_ORIGINS,
        "corsOriginRegex": ALLOW_ORIGIN_REGEX,
        "onnxProviders": ort.get_available_providers() if ort else [],
    }


@app.get("/api/models")
def models() -> dict[str, Any]:
    return {
        "default": DEFAULT_MODEL,
        "models": MODEL_PRESETS,
    }


@app.post("/api/warmup")
async def warmup(model: str | None = Query(default=None)) -> dict[str, Any]:
    model_name = normalize_model(model)
    started = time.perf_counter()
    await run_in_threadpool(get_session, model_name)
    return {
        "ok": True,
        "model": model_name,
        "ms": round((time.perf_counter() - started) * 1000),
    }


@app.post("/api/cutout")
async def cutout(
    image: UploadFile = File(...),
    model: str | None = Query(default=None),
    alpha_matting: bool | None = Query(default=None),
) -> Response:
    request_id = uuid.uuid4().hex[:12]
    started = time.perf_counter()
    model_name = normalize_model(model)
    raw = await image.read()
    validate_upload(image, raw)

    normalized, input_pixels = await run_in_threadpool(normalize_image_bytes, raw)
    session = await run_in_threadpool(get_session, model_name)
    output = await run_in_threadpool(
        remove,
        normalized,
        session=session,
        alpha_matting=resolve_alpha_matting(alpha_matting),
        post_process_mask=True,
    )
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    return Response(
        content=output,
        media_type="image/png",
        headers={
            "cache-control": "no-store",
            "x-vilo-cutout-model": model_name,
            "x-vilo-cutout-ms": str(elapsed_ms),
            "x-vilo-input-pixels": str(input_pixels),
            "x-vilo-output-bytes": str(len(output)),
            "x-vilo-request-id": request_id,
        },
    )


@lru_cache(maxsize=8)
def get_session(model_name: str):
    return new_session(model_name)


def normalize_model(model: str | None) -> str:
    model_name = (model or DEFAULT_MODEL).strip()
    if not model_name:
        model_name = DEFAULT_MODEL
    return model_name


def resolve_alpha_matting(explicit: bool | None) -> bool:
    if explicit is not None:
        return explicit
    return os.getenv("VILO_ALPHA_MATTING", "0").strip().lower() in {"1", "true", "yes", "on"}


def validate_upload(upload: UploadFile, raw: bytes) -> None:
    if not raw:
        raise HTTPException(status_code=400, detail="Missing image file.")

    max_bytes = int(MAX_UPLOAD_MB * 1024 * 1024)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Image is larger than {MAX_UPLOAD_MB:g}MB.")

    content_type = (upload.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload must be an image.")


def normalize_image_bytes(raw: bytes) -> tuple[bytes, int]:
    try:
        image = Image.open(BytesIO(raw))
        image = ImageOps.exif_transpose(image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read image.") from exc

    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

    input_pixels = image.width * image.height
    if input_pixels > MAX_INPUT_PIXELS:
        scale = math.sqrt(MAX_INPUT_PIXELS / input_pixels)
        next_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(next_size, Image.Resampling.LANCZOS)
        input_pixels = image.width * image.height

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue(), input_pixels


if os.getenv("VILO_WARMUP", "0").strip().lower() in {"1", "true", "yes", "on"}:
    get_session(DEFAULT_MODEL)
