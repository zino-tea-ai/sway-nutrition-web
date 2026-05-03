import { readFile } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const cutoutEndpoint = normalizeEndpoint(
  args["cutout-endpoint"] || process.env.VILO_CUTOUT_ENDPOINT || process.env.CUTOUT_ENDPOINT || "",
);
const model = args.model || process.env.VILO_REMOTE_CUTOUT_MODEL || process.env.VILO_CUTOUT_MODEL || "isnet-general-use";
const origin = args.origin || process.env.CUTOUT_TEST_ORIGIN || "https://sway-nutrition-web.vercel.app";
const samplePath = path.resolve(args.sample || "src/assets/samples/tea-bottle-source.jpg");

if (!cutoutEndpoint) {
  fail("Missing --cutout-endpoint or VILO_CUTOUT_ENDPOINT.");
}

const baseUrl = new URL(cutoutEndpoint);
baseUrl.pathname = baseUrl.pathname.replace(/\/api\/cutout\/?$/, "");
baseUrl.search = "";
baseUrl.hash = "";
const apiBase = baseUrl.toString().replace(/\/$/, "");
const analyzeEndpoint = `${apiBase}/api/analyze-food`;

await assertCors(cutoutEndpoint, origin);
const health = await getJson(`${apiBase}/health`, "health");
if (!health.ok || !health.openRouterKeyConfigured) {
  fail(`Health failed or OpenRouter key is missing: ${JSON.stringify(health)}`);
}

const contract = await getJson(`${apiBase}/api/contract`, "contract");
if (!contract?.endpoints?.cutout || !contract?.endpoints?.analyzeFood) {
  fail("Contract is missing cutout or analyzeFood.");
}

await postJson(`${apiBase}/api/warmup?model=${encodeURIComponent(model)}`, undefined, "warmup");
const image = await readFile(samplePath);
await assertCutoutJson(cutoutEndpoint, image, model);
await assertAnalyze(analyzeEndpoint, image);

console.log(JSON.stringify({
  ok: true,
  cutoutEndpoint,
  analyzeEndpoint,
  model,
  origin,
}, null, 2));

async function assertCors(endpoint, requestOrigin) {
  const response = await fetch(endpoint, {
    method: "OPTIONS",
    headers: {
      origin: requestOrigin,
      "access-control-request-method": "POST",
    },
  });
  const allowOrigin = response.headers.get("access-control-allow-origin") || "";
  if (!response.ok && response.status !== 204) {
    fail(`CORS preflight failed: ${response.status}`);
  }
  if (allowOrigin !== "*" && allowOrigin !== requestOrigin) {
    fail(`CORS does not allow ${requestOrigin}. Got: ${allowOrigin || "(empty)"}`);
  }
}

async function assertCutoutJson(endpoint, image, requestedModel) {
  const url = new URL(endpoint);
  url.searchParams.set("model", requestedModel);
  url.searchParams.set("response", "json");

  const formData = new FormData();
  formData.append("image", new Blob([image], { type: "image/jpeg" }), "tea-bottle-source.jpg");
  const payload = await postJson(url.toString(), formData, "cutout");

  for (const section of ["mask", "sticker"]) {
    const item = payload?.[section];
    if (!item?.imageBase64) fail(`Cutout JSON is missing ${section}.imageBase64.`);
    if (item.mime !== "image/png") fail(`Cutout JSON ${section} mime is ${item.mime}, not image/png.`);
    if (!(item.width > 0) || !(item.height > 0)) fail(`Cutout JSON ${section} dimensions are invalid.`);
    if (Buffer.from(item.imageBase64, "base64").length < 1024) {
      fail(`Cutout JSON ${section} image is too small.`);
    }
  }
  if (payload.mask.width < payload.sticker.width || payload.mask.height < payload.sticker.height) {
    fail("Sticker should fit inside the full-size mask.");
  }
}

async function assertAnalyze(endpoint, image) {
  const formData = new FormData();
  formData.append("image", new Blob([image], { type: "image/jpeg" }), "tea-bottle-source.jpg");
  const payload = await postJson(endpoint, formData, "analyze");
  for (const field of ["name", "localName", "type", "calories", "protein", "fiber", "confidence", "note"]) {
    if (!(field in payload)) fail(`Analyze response is missing ${field}.`);
  }
}

async function getJson(url, label) {
  const response = await fetch(url);
  return readJsonResponse(response, label);
}

async function postJson(url, body, label) {
  const options = { method: "POST" };
  if (body) options.body = body;
  const response = await fetch(url, options);
  return readJsonResponse(response, label);
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  if (!response.ok) {
    fail(`${label} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} did not return JSON: ${text.slice(0, 300)}`);
  }
}

function normalizeEndpoint(value) {
  if (!value) return "";
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) return "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname.endsWith("/api/cutout")) {
    url.pathname = `${url.pathname}/api/cutout`;
  }
  return url.toString();
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "1";
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
