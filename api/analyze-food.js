const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 24000;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "content-type": "application/json; charset=utf-8",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.VILO_OPENROUTER_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: "missing_openrouter_key" }, 500);
    }

    try {
      const image = await readImageInput(request);
      const analysis = await analyzeWithOpenRouter(image, apiKey, request);
      return jsonResponse(analysis, 200);
    } catch (error) {
      const status = error.status || 500;
      return jsonResponse(
        {
          error: error.code || "analysis_failed",
          message: status >= 500 ? "Food recognition failed." : error.message,
        },
        status,
      );
    }
  },
};

async function readImageInput(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("image");
    if (!file || typeof file.arrayBuffer !== "function") {
      throw badRequest("missing_image", "Upload an image field named image.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    validateImageBuffer(buffer);
    const mime = file.type || "image/jpeg";
    return { dataUrl: `data:${mime};base64,${buffer.toString("base64")}` };
  }

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const dataUrl = String(body.imageBase64 || body.imageDataUrl || "");
    if (!dataUrl.startsWith("data:image/")) {
      throw badRequest("missing_image", "Send imageBase64 as a data image URL.");
    }

    const base64 = dataUrl.split(",")[1] || "";
    validateImageBuffer(Buffer.from(base64, "base64"));
    return { dataUrl };
  }

  throw badRequest("unsupported_content_type", "Use multipart/form-data or JSON.");
}

function validateImageBuffer(buffer) {
  if (!buffer.length) throw badRequest("empty_image", "Image is empty.");
  if (buffer.length > MAX_IMAGE_BYTES) {
    const error = badRequest("image_too_large", "Image is too large.");
    error.status = 413;
    throw error;
  }
}

async function analyzeWithOpenRouter(image, apiKey, request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const model = process.env.VILO_OPENROUTER_MODEL || DEFAULT_MODEL;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "http-referer": process.env.VILO_OPENROUTER_SITE_URL || inferSiteUrl(request),
        "x-title": process.env.VILO_OPENROUTER_APP_TITLE || "Vilo Sticker Lab",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 420,
        response_format: foodSchema(),
        messages: [
          {
            role: "system",
            content:
              "You are a precise food recognition engine for a sticker-first nutrition app. Return only JSON that matches the schema. Prefer visible package labels when present. If the image shows a drink package, identify the drink itself, not nearby objects.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Identify the main food or drink in this image. Estimate calories, protein grams, and fiber grams for the visible item or common serving. Use clear English name, Chinese localName when possible, short Chinese note, and confidence 0-1.",
              },
              {
                type: "image_url",
                image_url: { url: image.dataUrl },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`OpenRouter returned ${response.status}.`);
      error.status = response.status === 401 ? 401 : 502;
      error.code = "openrouter_error";
      throw error;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = parseModelJson(content);
    return normalizeAnalysis(parsed, model);
  } finally {
    clearTimeout(timeout);
  }
}

function foodSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "food_sticker_analysis",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["name", "localName", "type", "calories", "protein", "fiber", "confidence", "note"],
        properties: {
          name: { type: "string" },
          localName: { type: "string" },
          type: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          fiber: { type: "number" },
          confidence: { type: "number" },
          note: { type: "string" },
        },
      },
    },
  };
}

function parseModelJson(content) {
  if (typeof content !== "string") return {};

  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }
}

function normalizeAnalysis(value, model) {
  return {
    name: cleanText(value.name, "Unknown food"),
    localName: cleanText(value.localName, "未知食物"),
    type: cleanText(value.type, "食物 / 待确认"),
    calories: finiteNumber(value.calories, 0),
    protein: finiteNumber(value.protein, 0),
    fiber: finiteNumber(value.fiber, 0),
    confidence: clamp(finiteNumber(value.confidence, 0.5), 0, 1),
    note: cleanText(value.note, "识别结果需要结合实际份量确认。"),
    provider: "openrouter",
    model,
  };
}

function cleanText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function inferSiteUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function badRequest(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
