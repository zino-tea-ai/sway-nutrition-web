import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const port = await getFreePort();
const targetUrl = `http://127.0.0.1:${port}/sticker-lab?remoteSample=1`;
const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");
const serverOutput = [];

const vite = spawn(
  process.execPath,
  [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  {
    env: {
      ...process.env,
      VILO_CUTOUT_MOCK: "sample",
      VITE_VILO_CUTOUT_ENDPOINT: "/api/cutout",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

vite.stdout.on("data", (chunk) => pushServerOutput(chunk));
vite.stderr.on("data", (chunk) => pushServerOutput(chunk));

try {
  await waitForHttp(targetUrl, 20000);
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
  if (serverOutput.length) {
    console.error("Vite/API server output:");
    console.error(serverOutput.join("").trim());
  }
  process.exit(1);
} finally {
  vite.kill();
  await waitForExit(vite, 3000).catch(() => undefined);
}

function pushServerOutput(chunk) {
  serverOutput.push(String(chunk));
  while (serverOutput.length > 80) serverOutput.shift();
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await sleep(150);
    }
    await sleep(150);
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
