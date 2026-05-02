import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const python = process.env.CUTOUT_PYTHON || ".venv-cutout\\Scripts\\python.exe";
const cutoutPort = Number(process.env.CUTOUT_PORT || (await getFreePort()));
const vitePort = Number(process.env.VITE_PORT || (await getFreePort()));
const model = process.env.VILO_CUTOUT_MODEL || "isnet-general-use";
const cutoutUrl = `http://127.0.0.1:${cutoutPort}`;
const targetUrl = `http://127.0.0.1:${vitePort}/sticker-lab?remoteSample=1`;
const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");

const api = spawn(
  python,
  ["-m", "uvicorn", "services.cutout_api.app:app", "--host", "127.0.0.1", "--port", String(cutoutPort)],
  {
    env: {
      ...process.env,
      VILO_CUTOUT_MODEL: model,
      VILO_CORS_ORIGINS: `http://127.0.0.1:${vitePort},http://localhost:${vitePort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const vite = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"],
  {
    env: {
      ...process.env,
      VITE_VILO_CUTOUT_ENDPOINT: `${cutoutUrl}/api/cutout`,
      VITE_VILO_REMOTE_CUTOUT_MODEL: model,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const apiOutput = collectOutput(api, "cutout-api");
const viteOutput = collectOutput(vite, "vite");

try {
  await waitForHttp(`${cutoutUrl}/health`, 45000);
  await waitForHttp(targetUrl, 45000);
  await warmup(`${cutoutUrl}/api/warmup?model=${encodeURIComponent(model)}`);

  const qa = spawn(process.execPath, ["scripts/sticker-lab-qa.mjs"], {
    env: {
      ...process.env,
      STICKER_LAB_URL: targetUrl,
    },
    stdio: "inherit",
  });
  const exitCode = await waitForExit(qa);
  if (exitCode !== 0) process.exit(exitCode);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  printOutput("cutout-api", apiOutput);
  printOutput("vite", viteOutput);
  process.exit(1);
} finally {
  api.kill();
  vite.kill();
  await Promise.allSettled([waitForExit(api, 3000), waitForExit(vite, 3000)]);
}

async function warmup(url) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Cutout warmup failed: ${response.status} ${text}`);
  }
}

function collectOutput(child, label) {
  const lines = [];
  const push = (chunk) => {
    lines.push(String(chunk));
    while (lines.length > 120) lines.shift();
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);
  child.on("error", (error) => push(`${label} error: ${error.message}\n`));
  return lines;
}

function printOutput(label, output) {
  if (!output.length) return;
  console.error(`\n${label} output:`);
  console.error(output.join("").trim());
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await sleep(250);
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function waitForExit(child, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
      return;
    }

    let timeout = 0;
    if (timeoutMs > 0) {
      timeout = setTimeout(() => reject(new Error("Process exit timed out")), timeoutMs);
    }

    child.once("exit", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve(code ?? 0);
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const nextPort = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(nextPort));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
