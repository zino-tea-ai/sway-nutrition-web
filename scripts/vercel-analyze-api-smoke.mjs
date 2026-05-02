import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import analyzeFoodApi from "../api/analyze-food.js";

const root = process.cwd();
const samplePath = path.join(root, "src", "assets", "samples", "tea-bottle-source.jpg");
const keyPath =
  process.env.OPENROUTER_ENV_FILE ||
  "C:\\Users\\WIN\\Documents\\Codex\\2026-05-02\\polymarket\\.env";

await loadOpenRouterKey(keyPath);

if (!process.env.OPENROUTER_API_KEY && !process.env.VILO_OPENROUTER_API_KEY) {
  throw new Error("Missing OPENROUTER_API_KEY or VILO_OPENROUTER_API_KEY.");
}

const bytes = await fs.readFile(samplePath);
const form = new FormData();
form.append("image", new File([bytes], "tea-bottle-source.jpg", { type: "image/jpeg" }));

const response = await analyzeFoodApi.fetch(
  new Request("https://vilo.local/api/analyze-food", {
    method: "POST",
    body: form,
  }),
);

const payload = await response.json();
console.log(
  JSON.stringify(
    {
      status: response.status,
      name: payload.name,
      localName: payload.localName,
      calories: payload.calories,
      provider: payload.provider,
      model: payload.model,
    },
    null,
    2,
  ),
);

if (!response.ok) {
  throw new Error(`Analyze API returned ${response.status}.`);
}

if (!payload.name || payload.provider !== "openrouter") {
  throw new Error("Analyze API did not return a valid OpenRouter result.");
}

async function loadOpenRouterKey(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const match = text.match(/^\s*#?\s*(OPENROUTER_API_KEY|VILO_OPENROUTER_API_KEY)\s*=\s*(.+)\s*$/m);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // The CI path should use real environment variables instead of this local helper.
  }
}
