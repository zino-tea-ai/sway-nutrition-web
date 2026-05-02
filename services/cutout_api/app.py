from __future__ import annotations

import base64
import json
import math
import logging
import os
import time
import urllib.error
import urllib.request
import uuid
from functools import lru_cache
from io import BytesIO
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from rembg import new_session, remove
from starlette.concurrency import run_in_threadpool

try:
    import onnxruntime as ort
except Exception:  # pragma: no cover - optional diagnostics
    ort = None


DEFAULT_MODEL = os.getenv("VILO_CUTOUT_MODEL", "isnet-general-use")
CONTRACT_VERSION = "2026-05-03"
ANALYZE_PROVIDER = os.getenv("VILO_ANALYZE_PROVIDER", "openrouter").strip().lower() or "openrouter"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("VILO_OPENROUTER_API_KEY") or ""
OPENROUTER_MODEL = os.getenv("VILO_OPENROUTER_MODEL", "google/gemini-2.5-flash")
OPENROUTER_API_URL = os.getenv("VILO_OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions")
OPENROUTER_SITE_URL = os.getenv("VILO_OPENROUTER_SITE_URL", "https://zino-tea-ai.github.io/sway-nutrition-web/")
OPENROUTER_APP_TITLE = os.getenv("VILO_OPENROUTER_APP_TITLE", "Vilo Sticker Lab")
OPENROUTER_TIMEOUT_SEC = float(os.getenv("VILO_OPENROUTER_TIMEOUT_SEC", "20"))
ANALYZE_MAX_EDGE = int(os.getenv("VILO_ANALYZE_MAX_EDGE", "1024"))
ANALYZE_JPEG_QUALITY = int(os.getenv("VILO_ANALYZE_JPEG_QUALITY", "84"))
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

SAMPLE_ANALYSIS: dict[str, Any] = {
    "name": "Master Kong Unsweetened Iced Black Tea",
    "localName": "康师傅无糖冰红茶",
    "type": "饮料 / 茶饮",
    "calories": 0,
    "protein": 0,
    "fiber": 0,
    "confidence": 0.86,
    "note": "无糖茶饮热量很低，适合记录为轻负担饮品；如果搭配正餐，继续看整体蛋白和纤维。",
}

DEFAULT_ANALYSIS: dict[str, Any] = {
    "name": "Food sticker",
    "localName": "食物贴纸",
    "type": "食物 / 待确认",
    "calories": 160,
    "protein": 5,
    "fiber": 2,
    "confidence": 0.32,
    "note": "这是后端预填结果，用来保证记录闭环可用；上线前应接入真实视觉识别模型并让用户确认。",
}

logger = logging.getLogger("vilo.cutout_api")
logging.basicConfig(level=os.getenv("VILO_LOG_LEVEL", "INFO").upper())


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
        "x-vilo-process-ms",
        "x-vilo-analyze-ms",
        "x-vilo-analyze-provider",
    ],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started = time.perf_counter()

    try:
        response = await call_next(request)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive production fallback
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        logger.exception("request_failed request_id=%s path=%s ms=%s", request_id, request.url.path, elapsed_ms)
        return JSONResponse(
            status_code=500,
            content=api_error("VILO_INTERNAL_ERROR", "The sticker service failed unexpectedly.", request_id),
            headers={
                "cache-control": "no-store",
                "x-vilo-request-id": request_id,
                "x-vilo-process-ms": str(elapsed_ms),
            },
        )

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    response.headers.setdefault("x-vilo-request-id", request_id)
    response.headers.setdefault("x-vilo-process-ms", str(elapsed_ms))
    return response


@app.exception_handler(HTTPException)
async def http_exception_response(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", uuid.uuid4().hex[:12])
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
    headers = dict(exc.headers or {})
    headers.setdefault("cache-control", "no-store")
    headers.setdefault("x-vilo-request-id", request_id)
    return JSONResponse(
        status_code=exc.status_code,
        content=api_error(status_to_code(exc.status_code), detail, request_id),
        headers=headers,
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "contractVersion": CONTRACT_VERSION,
        "defaultModel": DEFAULT_MODEL,
        "analyzeProvider": ANALYZE_PROVIDER,
        "openRouterModel": OPENROUTER_MODEL if ANALYZE_PROVIDER == "openrouter" else None,
        "openRouterKeyConfigured": bool(OPENROUTER_API_KEY),
        "maxUploadMb": MAX_UPLOAD_MB,
        "maxInputPixels": MAX_INPUT_PIXELS,
        "corsOrigins": ALLOW_ORIGINS,
        "corsOriginRegex": ALLOW_ORIGIN_REGEX,
        "onnxProviders": ort.get_available_providers() if ort else [],
    }


@app.get("/api/contract")
def contract() -> dict[str, Any]:
    return {
        "ok": True,
        "version": CONTRACT_VERSION,
        "endpoints": {
            "cutout": {
                "method": "POST",
                "path": "/api/cutout",
                "contentType": "multipart/form-data",
                "fileField": "image",
                "query": {"model": DEFAULT_MODEL, "alpha_matting": False},
                "response": "image/png",
                "headers": [
                    "x-vilo-request-id",
                    "x-vilo-cutout-ms",
                    "x-vilo-cutout-model",
                    "x-vilo-input-pixels",
                    "x-vilo-output-bytes",
                ],
            },
            "analyzeFood": {
                "method": "POST",
                "path": "/api/analyze-food",
                "contentType": "multipart/form-data",
                "fileField": "image",
                "response": {
                    "name": "string",
                    "localName": "string",
                    "type": "string",
                    "calories": "number",
                    "protein": "number",
                    "fiber": "number",
                    "confidence": "number",
                    "note": "string",
                    "provider": "openrouter | heuristic | mock",
                    "model": "string",
                },
            },
        },
        "errorShape": {
            "ok": False,
            "error": {"code": "string", "message": "string"},
            "requestId": "string",
        },
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
    request: Request,
    image: UploadFile = File(...),
    model: str | None = Query(default=None),
    alpha_matting: bool | None = Query(default=None),
) -> Response:
    request_id = request.state.request_id
    started = time.perf_counter()
    model_name = normalize_model(model)
    raw = await image.read()
    validate_upload(image, raw)

    normalized, input_pixels = await run_in_threadpool(normalize_image_bytes, raw)
    try:
        session = await run_in_threadpool(get_session, model_name)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not load cutout model: {model_name}.") from exc

    output = await run_in_threadpool(
        remove,
        normalized,
        session=session,
        alpha_matting=resolve_alpha_matting(alpha_matting),
        post_process_mask=True,
    )
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info(
        "cutout_complete request_id=%s model=%s pixels=%s bytes=%s ms=%s",
        request_id,
        model_name,
        input_pixels,
        len(output),
        elapsed_ms,
    )

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


@app.post("/api/analyze-food")
async def analyze_food(request: Request, image: UploadFile = File(...)) -> JSONResponse:
    request_id = request.state.request_id
    started = time.perf_counter()
    raw = await image.read()
    validate_upload(image, raw)

    analysis = await run_in_threadpool(create_analysis, image, raw)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info(
        "analyze_complete request_id=%s provider=%s name=%s confidence=%s ms=%s",
        request_id,
        analysis["provider"],
        analysis["name"],
        analysis["confidence"],
        elapsed_ms,
    )
    return JSONResponse(
        content={**analysis, "ok": True, "requestId": request_id},
        headers={
            "cache-control": "no-store",
            "x-vilo-analyze-ms": str(elapsed_ms),
            "x-vilo-analyze-provider": analysis["provider"],
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
    if model_name not in MODEL_PRESETS:
        raise HTTPException(status_code=422, detail=f"Unsupported cutout model: {model_name}.")
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
    image = open_image(raw)

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


def create_analysis(upload: UploadFile, raw: bytes) -> dict[str, Any]:
    if ANALYZE_PROVIDER in {"mock", "sample"}:
        return normalize_analysis(SAMPLE_ANALYSIS, "mock")

    if ANALYZE_PROVIDER == "openrouter":
        return create_openrouter_analysis(raw)

    if ANALYZE_PROVIDER != "heuristic":
        raise HTTPException(status_code=503, detail=f"Unsupported analyze provider: {ANALYZE_PROVIDER}.")

    filename = (upload.filename or "").lower()
    if any(token in filename for token in ["tea", "bottle", "drink", "beverage"]):
        return normalize_analysis(SAMPLE_ANALYSIS, "heuristic")

    image = open_image(raw).convert("RGB")
    stats = image_stats(image)
    if stats["green"] > 0.34 and stats["saturation"] > 0.22:
        candidate = {
            **DEFAULT_ANALYSIS,
            "name": "Fresh food plate",
            "localName": "清爽餐食",
            "type": "餐食 / 蔬果",
            "calories": 220,
            "protein": 8,
            "fiber": 5,
            "confidence": 0.42,
            "note": "画面里绿色和高饱和区域较多，先按清爽餐食预填；最终以用户确认后的名称和份量为准。",
        }
        return normalize_analysis(candidate, "heuristic")

    if stats["warm"] > 0.36:
        candidate = {
            **DEFAULT_ANALYSIS,
            "name": "Warm food plate",
            "localName": "热食餐盘",
            "type": "餐食 / 热食",
            "calories": 360,
            "protein": 13,
            "fiber": 3,
            "confidence": 0.4,
            "note": "画面里暖色食物区域较多，先按热食餐盘预填；下一步应接真实视觉模型来识别具体菜名。",
        }
        return normalize_analysis(candidate, "heuristic")

    return normalize_analysis(DEFAULT_ANALYSIS, "heuristic")


def create_openrouter_analysis(raw: bytes) -> dict[str, Any]:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured.")

    image_data_url, image_pixels = encode_image_for_openrouter(raw)
    payload = {
        "model": OPENROUTER_MODEL,
        "temperature": 0.1,
        "max_tokens": 520,
        "response_format": food_analysis_response_format(),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Vilo's food recognition service. Identify the visible food or drink for a consumer "
                    "food sticker log. Return one concise JSON object only. Estimate nutrition conservatively. "
                    "If the image is ambiguous, use a lower confidence and phrase the note as a confirmation prompt."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Analyze this image for a food sticker app. Output JSON with these exact fields: "
                            "name, localName, type, calories, protein, fiber, confidence, note. "
                            "Use English for name. Use natural Simplified Chinese for localName, type, and note. "
                            "Do not copy uncertain package OCR into localName; if the brand text is unclear, translate "
                            "the visible food/drink into a normal Chinese display name such as 无糖冰红茶, 番茄面, or 热食餐盘. "
                            "type must be a short Chinese category pair like 饮料 / 茶饮 or 餐食 / 热食. "
                            "calories is kcal for the likely visible portion; protein and fiber are grams. "
                            "confidence is 0 to 1."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_url},
                    },
                ],
            },
        ],
    }
    request = urllib.request.Request(
        OPENROUTER_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=openrouter_headers(),
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=OPENROUTER_TIMEOUT_SEC) as response:
            response_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"OpenRouter returned {exc.code}: {truncate(body, 300)}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="OpenRouter request timed out.") from exc

    try:
        completion = json.loads(response_body)
        content = completion["choices"][0]["message"]["content"]
        analysis_payload = parse_model_json(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="OpenRouter returned an invalid analysis payload.") from exc

    normalized = normalize_analysis(analysis_payload, "openrouter")
    normalized["model"] = completion.get("model") or OPENROUTER_MODEL
    normalized["inputPixels"] = image_pixels
    return normalized


def encode_image_for_openrouter(raw: bytes) -> tuple[str, int]:
    image = open_image(raw).convert("RGB")
    if max(image.size) > ANALYZE_MAX_EDGE:
        image.thumbnail((ANALYZE_MAX_EDGE, ANALYZE_MAX_EDGE), Image.Resampling.LANCZOS)

    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=ANALYZE_JPEG_QUALITY, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}", image.width * image.height


def openrouter_headers() -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    if OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = OPENROUTER_SITE_URL
    if OPENROUTER_APP_TITLE:
        headers["X-OpenRouter-Title"] = OPENROUTER_APP_TITLE
    return headers


def food_analysis_response_format() -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "vilo_food_sticker_analysis",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "localName", "type", "calories", "protein", "fiber", "confidence", "note"],
                "properties": {
                    "name": {"type": "string"},
                    "localName": {"type": "string"},
                    "type": {"type": "string"},
                    "calories": {"type": "number", "minimum": 0, "maximum": 2500},
                    "protein": {"type": "number", "minimum": 0, "maximum": 250},
                    "fiber": {"type": "number", "minimum": 0, "maximum": 100},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "note": {"type": "string"},
                },
            },
        },
    }


def parse_model_json(content: Any) -> dict[str, Any]:
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(content, str):
        raise ValueError("Model content is not text.")

    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def image_stats(image: Image.Image) -> dict[str, float]:
    image.thumbnail((96, 96))
    pixels = list(image.getdata())
    if not pixels:
        return {"warm": 0, "green": 0, "saturation": 0}

    warm = 0
    green = 0
    saturation_total = 0.0
    for red, green_value, blue in pixels:
        maximum = max(red, green_value, blue)
        minimum = min(red, green_value, blue)
        saturation_total += 0 if maximum == 0 else (maximum - minimum) / maximum
        if red > green_value * 1.08 and red > blue * 1.12:
            warm += 1
        if green_value > red * 1.04 and green_value > blue * 1.04:
            green += 1

    total = len(pixels)
    return {
        "warm": warm / total,
        "green": green / total,
        "saturation": saturation_total / total,
    }


def normalize_analysis(payload: dict[str, Any], provider: str) -> dict[str, Any]:
    return {
        "name": str(payload.get("name") or DEFAULT_ANALYSIS["name"]),
        "localName": str(payload.get("localName") or DEFAULT_ANALYSIS["localName"]),
        "type": str(payload.get("type") or DEFAULT_ANALYSIS["type"]),
        "calories": clamp_number(payload.get("calories"), 0, 2500, DEFAULT_ANALYSIS["calories"]),
        "protein": clamp_number(payload.get("protein"), 0, 250, DEFAULT_ANALYSIS["protein"]),
        "fiber": clamp_number(payload.get("fiber"), 0, 100, DEFAULT_ANALYSIS["fiber"]),
        "confidence": clamp_number(payload.get("confidence"), 0, 1, DEFAULT_ANALYSIS["confidence"]),
        "note": str(payload.get("note") or DEFAULT_ANALYSIS["note"]),
        "provider": provider,
        "model": payload.get("model") or (OPENROUTER_MODEL if provider == "openrouter" else provider),
        "contractVersion": CONTRACT_VERSION,
    }


def clamp_number(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(fallback)
    number = min(max(number, minimum), maximum)
    return int(number) if number.is_integer() else round(number, 2)


def open_image(raw: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(raw))
        return ImageOps.exif_transpose(image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read image.") from exc


def status_to_code(status_code: int) -> str:
    return {
        400: "VILO_BAD_IMAGE",
        413: "VILO_IMAGE_TOO_LARGE",
        415: "VILO_UNSUPPORTED_MEDIA_TYPE",
        422: "VILO_UNSUPPORTED_MODEL",
        503: "VILO_SERVICE_UNAVAILABLE",
    }.get(status_code, "VILO_REQUEST_FAILED")


def api_error(code: str, message: str, request_id: str) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
        },
        "requestId": request_id,
    }


def truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 1] + "…"


if os.getenv("VILO_WARMUP", "0").strip().lower() in {"1", "true", "yes", "on"}:
    get_session(DEFAULT_MODEL)
