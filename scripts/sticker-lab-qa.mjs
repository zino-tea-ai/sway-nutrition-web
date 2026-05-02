import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const targetUrl = process.env.STICKER_LAB_URL || "http://127.0.0.1:5188/sticker-lab";
const chromePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = path.resolve("qa-screens", "sticker-lab-qa");
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop-frame", width: 768, height: 900 },
];

async function runViewport(viewport) {
  const port = await getFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "sticker-lab-chrome-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${viewport.width},${viewport.height}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  try {
    const wsUrl = await waitForWebSocketUrl(port);
    const cdp = await CDP.connect(wsUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await navigate(cdp, targetUrl);

    const layout = [];
    const screenshots = [];

    await settle();
    layout.push({ phase: "camera", ...(await layoutReport(cdp)) });
    screenshots.push(await screenshot(cdp, viewport, "camera"));

    const startedAt = Date.now();
    await clickByAria(cdp, "Sample");
    await sleep(260);
    layout.push({ phase: "cutting", ...(await layoutReport(cdp)) });
    screenshots.push(await screenshot(cdp, viewport, "cutting"));

    const revealSeen = await waitForExpression(cdp, "!!document.querySelector('.confirm-flow.is-revealing')", 20000, {
      optional: true,
    });
    if (revealSeen) {
      await sleep(160);
      layout.push({ phase: "reveal", ...(await layoutReport(cdp)) });
      screenshots.push(await screenshot(cdp, viewport, "reveal"));
    }

    await waitForExpression(
      cdp,
      "!!document.querySelector('button[aria-label=\"Confirm sticker\"]') && !document.querySelector('.confirm-flow.is-revealing')",
      70000,
    );
    const cutoutMs = Date.now() - startedAt;
    layout.push({ phase: "confirm", ...(await layoutReport(cdp)) });
    screenshots.push(await screenshot(cdp, viewport, "confirm"));
    const exportedCutout = await exportCurrentSticker(cdp, viewport).catch(() => null);

    await clickByAria(cdp, "Confirm sticker");
    await waitForExpression(cdp, "!!document.querySelector('button[aria-label=\"Add to today\"]')", 10000);
    layout.push({ phase: "detail", ...(await layoutReport(cdp)) });
    screenshots.push(await screenshot(cdp, viewport, "detail"));

    await clickByAria(cdp, "Add to today");
    await waitForExpression(cdp, "!!document.querySelector('.history-flow')", 10000);
    layout.push({ phase: "history", ...(await layoutReport(cdp)) });
    screenshots.push(await screenshot(cdp, viewport, "history"));

    await cdp.close();
    return { viewport, cutoutMs, revealSeen, screenshots, exportedCutout, layout };
  } finally {
    chrome.kill();
    await waitForProcessExit(chrome, 3000).catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true }).catch((error) => {
      console.warn(`Could not remove Chrome temp dir: ${error.message}`);
    });
  }
}

async function navigate(cdp, url) {
  const loaded = cdp.waitForEvent("Page.loadEventFired", 15000);
  await cdp.send("Page.navigate", { url });
  await loaded.catch(() => undefined);
}

async function screenshot(cdp, viewport, phase) {
  const response = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const filename = `${viewport.name}-${phase}.png`;
  const fullPath = path.join(outputDir, filename);
  await writeFile(fullPath, response.data, "base64");
  return filename;
}

async function exportCurrentSticker(cdp, viewport) {
  const dataUrl = await evaluate(
    cdp,
    `(() => {
      const image = document.querySelector(".confirm-stage img");
      if (!image?.src) return null;
      return fetch(image.src)
        .then((response) => response.blob())
        .then((blob) => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }));
    })()`,
  );
  if (!dataUrl) return null;
  const base64 = dataUrl.split(",")[1];
  const filename = `${viewport.name}-sample-cutout.png`;
  await writeFile(path.join(outputDir, filename), base64, "base64");
  return filename;
}

async function clickByAria(cdp, label) {
  const clicked = await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((node) => node.getAttribute("aria-label") === ${JSON.stringify(label)});
      if (!button) return false;
      button.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`Button not found: ${label}`);
}

async function layoutReport(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const toRect = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
        };
      };
      const rect = (selector) => toRect(document.querySelector(selector));
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
      };
      const app = rect(".app-viewport");
      const issues = [];
      const addIssue = (condition, message) => {
        if (condition) issues.push(message);
      };
      const nearCenter = (box, tolerance, label) => {
        if (!box || !app) return;
        addIssue(Math.abs(box.cx - app.cx) > tolerance, label + " is off center");
      };
      const verticalGap = (upper, lower, gap, label) => {
        if (!upper || !lower) return;
        addIssue(upper.bottom > lower.top - gap, label + " vertical overlap");
      };

      addIssue(!app, "app viewport missing");
      if (app) {
        addIssue(app.left < -0.5, "app viewport bleeds left");
        addIssue(app.right > viewport.width + 0.5, "app viewport bleeds right");
      }
      addIssue(viewport.scrollWidth > viewport.width + 1, "horizontal overflow");

      const bottom = rect(".capture-bottom");
      if (bottom && app) {
        addIssue(bottom.left < app.left - 0.5, "capture controls bleed left");
        addIssue(bottom.right > app.right + 0.5, "capture controls bleed right");
      }
      nearCenter(rect(".shutter-button"), 4, "shutter");
      nearCenter(rect(".confirm-stage"), 4, "confirm stage");
      const detailSticker = rect(".detail-sticker");
      const detailTitle = rect(".detail-title-row");
      const detailActions = rect(".detail-actions");
      const nutritionRibbon = rect(".nutrition-ribbon");
      const aiNote = rect(".ai-note");
      const addCopy = rect(".add-copy-button");
      nearCenter(detailSticker, 4, "detail sticker");
      nearCenter(detailTitle, 4, "detail title");
      nearCenter(nutritionRibbon, 4, "nutrition ribbon");
      nearCenter(rect(".detail-actions .main-check"), 5, "detail check button");
      verticalGap(detailSticker, detailTitle, 6, "detail sticker/title");
      verticalGap(detailTitle, detailActions, 8, "detail title/actions");
      verticalGap(detailActions, nutritionRibbon, 8, "detail actions/nutrition");
      verticalGap(nutritionRibbon, aiNote, 8, "detail nutrition/note");
      verticalGap(aiNote, addCopy, 8, "detail note/add button");
      if (addCopy) {
        addIssue(addCopy.bottom > viewport.height - 6, "detail add button below fold");
      }

      const historyOverlaps = [...document.querySelectorAll(".history-item")].filter((item) => {
        const sticker = toRect(item.querySelector(".sticker-object"));
        const text = toRect(item.querySelector("strong"));
        return sticker && text && sticker.bottom > text.top - 8;
      }).length;
      addIssue(historyOverlaps > 0, "history sticker overlaps text");

      return {
        viewport,
        rects: {
          app,
          bottom,
          shutter: rect(".shutter-button"),
          confirmStage: rect(".confirm-stage"),
          detailSticker,
          detailTitle,
          detailActions,
          nutritionRibbon,
          aiNote,
          addCopy,
        },
        issues,
      };
    })()`,
  );
}

async function waitForExpression(cdp, expression, timeoutMs, options = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, expression).catch(() => false);
    if (value) return true;
    await sleep(120);
  }
  if (options.optional) return false;
  throw new Error(`Timed out waiting for ${expression}`);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Runtime evaluation failed");
  }
  return response.result?.value;
}

async function settle() {
  await sleep(450);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => reject(new Error("Process exit timed out")), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
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
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForWebSocketUrl(port) {
  const url = `http://127.0.0.1:${port}/json/list`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const payload = await response.json();
        const page = payload.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Chrome debugging endpoint did not start");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }

      const waiters = this.eventWaiters.get(message.method);
      if (waiters?.length) {
        const waiter = waiters.shift();
        clearTimeout(waiter.timeout);
        waiter.resolve(message.params || {});
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }
      }, 20000);
    });
  }

  waitForEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Event timed out: ${method}`)), timeoutMs);
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push({ resolve, timeout });
      this.eventWaiters.set(method, waiters);
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const results = [];
  for (const viewport of viewports) {
    results.push(await runViewport(viewport));
  }

  const report = {
    targetUrl,
    generatedAt: new Date().toISOString(),
    results,
  };

  await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));

  const blockingIssues = results.flatMap((result) =>
    result.layout.flatMap((layout) =>
      layout.issues.map((issue) => `${result.viewport.name}/${layout.phase}: ${issue}`),
    ),
  );

  for (const result of results) {
    console.log(
      `${result.viewport.name}: cutout=${result.cutoutMs}ms reveal=${result.revealSeen ? "seen" : "missed"} screenshots=${result.screenshots.length}`,
    );
  }

  if (blockingIssues.length > 0) {
    console.error("Layout issues:");
    for (const issue of blockingIssues) console.error(`- ${issue}`);
    process.exit(1);
  }
}

await main();
