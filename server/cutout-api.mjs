import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";

const sampleCutoutUrl = new URL("../src/assets/samples/tea-bottle-cutout.png", import.meta.url);

export function cutoutApiPlugin() {
  return {
    name: "vilo-cutout-api",
    configureServer(server) {
      server.middlewares.use("/api/cutout", async (req, res) => {
        try {
          const response = await createCutoutResponse(await nodeRequestToWebRequest(req));
          await writeWebResponse(res, response);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Cutout endpoint failed.";
          await writeJson(res, 500, { error: message });
        }
      });

      server.middlewares.use("/api/analyze-food", async (req, res) => {
        try {
          const response = await createAnalyzeResponse(await nodeRequestToWebRequest(req, "/api/analyze-food"));
          await writeWebResponse(res, response);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analyze endpoint failed.";
          await writeJson(res, 500, { error: message });
        }
      });
    },
  };
}

export async function createCutoutResponse(request) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "POST image multipart/form-data to this endpoint." });
  }

  const formData = await request.formData();
  const image = formData.get("image") || formData.get("image_file");
  if (!isBlobLike(image)) {
    return jsonResponse(400, { error: "Missing image file field." });
  }

  const provider = resolveProvider();
  if (provider === "remove-bg") return removeBgCutout(image);
  if (provider === "clipdrop") return clipdropCutout(image);
  if (process.env.VILO_CUTOUT_MOCK === "sample") return sampleCutoutResponse();

  return jsonResponse(503, {
    code: "VILO_CUTOUT_PROVIDER_MISSING",
    error: "Set REMOVE_BG_API_KEY or CLIPDROP_API_KEY to enable the high quality cutout endpoint.",
  });
}

export async function createAnalyzeResponse(request) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "POST image multipart/form-data to this endpoint." });
  }

  const formData = await request.formData();
  const image = formData.get("image") || formData.get("image_file");
  if (!isBlobLike(image)) {
    return jsonResponse(400, { error: "Missing image file field." });
  }

  return jsonResponse(200, {
    ok: true,
    name: "Master Kong Unsweetened Iced Black Tea",
    localName: "康师傅无糖冰红茶",
    type: "饮料 / 茶饮",
    calories: 0,
    protein: 0,
    fiber: 0,
    confidence: 0.86,
    note: "无糖茶饮热量很低，适合记录为轻负担饮品；如果搭配正餐，继续看整体蛋白和纤维。",
    provider: "vite-mock",
    model: "sample",
  });
}

function resolveProvider() {
  const explicit = process.env.VILO_CUTOUT_PROVIDER?.trim().toLowerCase();
  if (explicit === "remove-bg" || explicit === "removebg") return "remove-bg";
  if (explicit === "clipdrop") return "clipdrop";
  if (process.env.REMOVE_BG_API_KEY) return "remove-bg";
  if (process.env.CLIPDROP_API_KEY) return "clipdrop";
  return "";
}

async function removeBgCutout(image) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return jsonResponse(503, { error: "REMOVE_BG_API_KEY is not configured." });

  const formData = new FormData();
  formData.append("size", process.env.REMOVE_BG_SIZE || "auto");
  formData.append("format", "png");
  appendImageFile(formData, "image_file", image);

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  return providerBinaryResponse(response, "remove-bg");
}

async function clipdropCutout(image) {
  const apiKey = process.env.CLIPDROP_API_KEY;
  if (!apiKey) return jsonResponse(503, { error: "CLIPDROP_API_KEY is not configured." });

  const formData = new FormData();
  appendImageFile(formData, "image_file", image);
  formData.append("transparency_handling", "return_input_if_non_opaque");

  const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
    method: "POST",
    headers: {
      accept: "image/png",
      "x-api-key": apiKey,
    },
    body: formData,
  });

  return providerBinaryResponse(response, "clipdrop");
}

async function providerBinaryResponse(response, provider) {
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const creditsRemaining = response.headers.get("x-remaining-credits");
  const creditsConsumed = response.headers.get("x-credits-consumed");

  if (!response.ok) {
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { error: await response.text().catch(() => response.statusText) };
    return jsonResponse(response.status, {
      provider,
      error: body.error || body.message || response.statusText,
    });
  }

  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": contentType.includes("image/") ? contentType : "image/png",
    "x-vilo-cutout-provider": provider,
  });
  if (creditsRemaining) headers.set("x-remaining-credits", creditsRemaining);
  if (creditsConsumed) headers.set("x-credits-consumed", creditsConsumed);

  return new Response(await response.arrayBuffer(), { headers });
}

async function sampleCutoutResponse() {
  return new Response(await readFile(sampleCutoutUrl), {
    headers: {
      "cache-control": "no-store",
      "content-type": "image/png",
      "x-vilo-cutout-provider": "mock-sample",
    },
  });
}

function appendImageFile(formData, fieldName, image) {
  const filename = image.name || "vilo-food-photo.png";
  const type = image.type || "image/png";
  formData.append(fieldName, image, filename);
  if (type && image.type !== type) {
    formData.set(fieldName, new File([image], filename, { type }));
  }
}

function isBlobLike(value) {
  return value && typeof value.arrayBuffer === "function" && typeof value.type === "string";
}

async function nodeRequestToWebRequest(req, pathname = "/api/cutout") {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }

  return new Request(`http://127.0.0.1${pathname}`, {
    method: req.method || "GET",
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req),
    duplex: "half",
  });
}

async function writeWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

async function writeJson(res, status, payload) {
  await writeWebResponse(res, jsonResponse(status, payload));
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
  });
}
