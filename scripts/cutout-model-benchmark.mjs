import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.CUTOUT_ENDPOINT || "http://127.0.0.1:8787/api/cutout";
const sourcePath = process.env.CUTOUT_BENCH_IMAGE || "src/assets/samples/tea-bottle-source.jpg";
const models = (process.env.CUTOUT_BENCH_MODELS || "u2netp,silueta,isnet-general-use")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const outputDir = path.resolve("qa-screens", "cutout-benchmark");

await mkdir(outputDir, { recursive: true });

const fileBytes = await readFile(sourcePath);
const rows = [];

for (const model of models) {
  const formData = new FormData();
  formData.append("image", new Blob([fileBytes], { type: "image/jpeg" }), path.basename(sourcePath));
  const started = Date.now();
  const response = await fetch(`${endpoint}?model=${encodeURIComponent(model)}`, {
    method: "POST",
    body: formData,
  });
  const elapsedMs = Date.now() - started;
  const output = Buffer.from(await response.arrayBuffer());
  const filename = `${model.replace(/[^a-z0-9_-]/gi, "_")}.png`;

  if (!response.ok) {
    rows.push({ model, ok: false, elapsedMs, status: response.status, bytes: output.length });
    continue;
  }

  await writeFile(path.join(outputDir, filename), output);
  rows.push({
    model,
    ok: true,
    elapsedMs,
    headerMs: Number(response.headers.get("x-vilo-cutout-ms") || 0),
    bytes: output.length,
    file: filename,
  });
}

await writeFile(path.join(outputDir, "report.json"), JSON.stringify({ endpoint, sourcePath, rows }, null, 2));
console.table(rows);
