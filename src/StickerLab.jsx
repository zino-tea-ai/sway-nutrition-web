import { preload, removeBackground } from "@imgly/background-removal";
import {
  Camera,
  Check,
  ChevronLeft,
  Crop,
  RotateCcw,
  ScanLine,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import avocado from "./assets/stickers/avocado.png";
import honey from "./assets/stickers/honey_pot.png";
import sampleBottleCutout from "./assets/samples/tea-bottle-cutout.png";
import sampleBottlePhoto from "./assets/samples/tea-bottle-source.jpg";
import "./sticker-lab.css";

const todayLabel = "5月03";

const fallbackAnalysis = {
  name: "Master Kong Unsweetened Iced Black Tea",
  localName: "康师傅无糖冰红茶",
  type: "饮料 / 茶饮",
  calories: 0,
  protein: 0,
  fiber: 0,
  confidence: 0.86,
  note: "无糖茶饮热量很低，适合记录为轻负担饮品；如果搭配正餐，继续看整体蛋白和纤维。",
};

const cutoutConfig = {
  model: import.meta.env.VITE_VILO_CUTOUT_MODEL || "isnet_quint8",
  output: { format: "image/png", type: "foreground" },
};

const seedHistory = [
  {
    id: "seed-tea",
    date: "5月01",
    image: honey,
    name: "Honey toast",
    localName: "蜂蜜吐司",
  },
  {
    id: "seed-gum",
    date: "4月29",
    image: avocado,
    name: "Avocado snack",
    localName: "牛油果加餐",
  },
];

function StickerLab() {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const revealTimerRef = useRef(0);
  const [phase, setPhase] = useState("camera");
  const [sourceUrl, setSourceUrl] = useState(null);
  const [stickerUrl, setStickerUrl] = useState(null);
  const [analysis, setAnalysis] = useState(fallbackAnalysis);
  const [cameraStream, setCameraStream] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(seedHistory);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (import.meta.env.VITE_VILO_CUTOUT_ENDPOINT) return undefined;

    let cancelled = false;
    const warmModel = () => {
      preload(cutoutConfig).catch(() => {
        if (!cancelled) setProgress((value) => Math.max(value, 0));
      });
    };
    const idleId =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(warmModel, { timeout: 1400 })
        : window.setTimeout(warmModel, 900);

    return () => {
      cancelled = true;
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (stickerUrl) URL.revokeObjectURL(stickerUrl);
      stopStream(cameraStream);
    };
  }, [sourceUrl, stickerUrl, cameraStream]);

  async function processImage(file, options = {}) {
    if (!file) return;

    setError("");
    setProgress(4);
    setPhase("cutting");
    window.clearTimeout(revealTimerRef.current);
    const startedAt = performance.now();
    const progressTimer = window.setInterval(() => {
      setProgress((value) => {
        if (value < 28) return Math.min(28, value + 8);
        if (value < 64) return Math.min(64, value + 4);
        return Math.min(91, value + 1);
      });
    }, 160);

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (stickerUrl) URL.revokeObjectURL(stickerUrl);

    const nextSourceUrl = URL.createObjectURL(file);
    setSourceUrl(nextSourceUrl);
    setStickerUrl(null);
    setAnalysis(fallbackAnalysis);

    try {
      const cutoutTask = options.cutoutBlob
        ? Promise.resolve(options.cutoutBlob)
        : createCutout(file, (percent) => setProgress(percent));
      const [cutoutBlob, nextAnalysis] = await Promise.all([
        cutoutTask,
        analyzeFood(file),
        delay(options.minimumCuttingMs || 0),
      ]);
      const cleanedBlob = await cleanStickerBlob(cutoutBlob);
      const nextStickerUrl = URL.createObjectURL(cleanedBlob);
      setStickerUrl(nextStickerUrl);
      setAnalysis(nextAnalysis);
      setBurstKey((value) => value + 1);
      setProgress(100);
      setPhase("revealing");
      const elapsed = performance.now() - startedAt;
      const revealDelay = elapsed < 650 ? 920 : 760;
      revealTimerRef.current = window.setTimeout(() => setPhase("confirm"), revealDelay);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the sticker.");
      setProgress(0);
      setPhase("camera");
    } finally {
      window.clearInterval(progressTimer);
    }
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1920 },
        },
        audio: false,
      });
      setCameraStream(stream);
      setPhase("camera");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera is unavailable. Use upload instead.");
      fileInputRef.current?.click();
    }
  }

  function stopCamera() {
    stopStream(cameraStream);
    setCameraStream(null);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1440;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      processImage(new File([blob], `vilo-capture-${Date.now()}.png`, { type: "image/png" }));
    }, "image/png");
  }

  async function runSampleFlow() {
    const [file, cutoutBlob] = await Promise.all([makeSampleBottleFile(), fetchBlob(sampleBottleCutout)]);
    processImage(file, { cutoutBlob, minimumCuttingMs: 1150 });
  }

  function resetFlow() {
    stopCamera();
    window.clearTimeout(revealTimerRef.current);
    setPhase("camera");
    setProgress(0);
    setError("");
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (stickerUrl) URL.revokeObjectURL(stickerUrl);
    setSourceUrl(null);
    setStickerUrl(null);
    setAnalysis(fallbackAnalysis);
  }

  function addToHistory() {
    if (!stickerUrl) return;
    setHistory((items) => [
      {
        id: `capture-${Date.now()}`,
        date: todayLabel,
        image: stickerUrl,
        isCapture: true,
        name: analysis.name,
        localName: analysis.localName,
      },
      ...items,
    ]);
    setPhase("history");
  }

  const commonProps = {
    analysis,
    burstKey,
    error,
    fileInputRef,
    progress,
    sourceUrl,
    stickerUrl,
    onBack: resetFlow,
    onFile: processImage,
  };

  return (
    <main className="sticker-lab">
      <section className="app-viewport" aria-label="Vilo sticker capture">
        {phase === "camera" || phase === "cutting" ? (
          <CaptureFlow
            {...commonProps}
            cameraStream={cameraStream}
            phase={phase}
            videoRef={videoRef}
            onCamera={cameraStream ? captureFrame : startCamera}
            onSample={runSampleFlow}
          />
        ) : null}

        {(phase === "revealing" || phase === "confirm") && (
          <ConfirmFlow
            {...commonProps}
            isRevealing={phase === "revealing"}
            onConfirm={() => setPhase("detail")}
            onRetake={resetFlow}
          />
        )}

        {phase === "detail" && (
          <DetailFlow
            {...commonProps}
            onAdd={addToHistory}
            onDelete={resetFlow}
            onRetake={() => setPhase("confirm")}
          />
        )}

        {phase === "history" && (
          <HistoryFlow
            history={history}
            onBack={() => setPhase("detail")}
            onNew={resetFlow}
          />
        )}

        <canvas ref={captureCanvasRef} hidden />
      </section>
    </main>
  );
}

function CaptureFlow({
  cameraStream,
  error,
  fileInputRef,
  onBack,
  onCamera,
  onFile,
  onSample,
  phase,
  progress,
  sourceUrl,
  videoRef,
}) {
  return (
    <section className={`capture-flow is-${phase}`}>
      <div className="capture-media">
        {cameraStream ? (
          <video ref={videoRef} autoPlay playsInline muted />
        ) : sourceUrl ? (
          <img src={sourceUrl} alt="Captured food" className="capture-photo" />
        ) : (
          <div className="empty-camera" aria-hidden="true">
            <div className="empty-camera-mark">
              <Camera size={32} />
            </div>
            <h1>Make a food sticker</h1>
            <p>Snap food. Lift it out. Save the story.</p>
          </div>
        )}

        <button type="button" className="round-button capture-close" onClick={onBack} aria-label="Close">
          <X size={19} />
        </button>

        <FocusCorners hidden={phase === "cutting"} />

        {phase === "cutting" && sourceUrl && (
          <div className="cutting-layer" aria-live="polite">
            <PhotoDissolve key={sourceUrl} src={sourceUrl} />
            <div className="cutting-wash" />
            <div className="scan-pill">
              <ScanLine size={15} />
              <span>lifting subject {progress}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="capture-bottom">
        <button
          type="button"
          className="ghost-button"
          disabled={phase === "cutting"}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload"
        >
          <Upload size={18} />
          <span>Upload</span>
        </button>
        <button
          type="button"
          className="shutter-button"
          disabled={phase === "cutting"}
          onClick={onCamera}
          aria-label="Capture"
        >
          <Camera size={27} />
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={phase === "cutting"}
          onClick={onSample}
          aria-label="Sample"
        >
          <Sparkles size={18} />
          <span>Sample</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => onFile(event.target.files?.[0])}
      />

      {error && <p className="camera-error">{error}</p>}
    </section>
  );
}

function ConfirmFlow({ burstKey, isRevealing, onBack, onConfirm, onRetake, sourceUrl, stickerUrl }) {
  return (
    <section className={`confirm-flow ${isRevealing ? "is-revealing" : ""}`}>
      {sourceUrl && <img src={sourceUrl} alt="" className="confirm-ghost-photo" />}
      {sourceUrl && <PhotoDissolve key={`confirm-${sourceUrl}`} src={sourceUrl} compact />}
      <TopDateBar onBack={onBack} variant="dark" />

      <div className="confirm-stage">
        {stickerUrl && (
          <>
            <StickerObject src={stickerUrl} alt="Lifted food sticker" />
            <DissolveBurst key={`${stickerUrl}-${burstKey}`} src={stickerUrl} />
          </>
        )}
      </div>

      {isRevealing && (
        <div className="reveal-pill" aria-live="polite">
          <Sparkles size={14} />
          <span>subject lifted</span>
        </div>
      )}

      <div className="confirm-actions">
        <button type="button" className="soft-circle" onClick={onRetake} aria-label="Retake">
          <RotateCcw size={20} />
        </button>
        <button type="button" className="main-check" onClick={onConfirm} aria-label="Confirm sticker">
          <Check size={26} />
        </button>
        <button type="button" className="soft-circle" aria-label="Crop">
          <Crop size={20} />
        </button>
      </div>
    </section>
  );
}

function DetailFlow({ analysis, onAdd, onBack, onDelete, onRetake, stickerUrl }) {
  return (
    <section className="detail-flow">
      <TopDateBar onBack={onBack} />

      <article className="sticker-detail-card">
        <div className="detail-aura" />
        <div className="detail-sticker">
          {stickerUrl && <StickerObject src={stickerUrl} alt={analysis.name} />}
        </div>

        <div className="detail-title-row">
          <h1>{analysis.name}</h1>
          <button type="button" className="sound-button" aria-label="Listen">
            <Volume2 size={16} />
          </button>
        </div>
        <p>{analysis.localName}</p>

        <div className="detail-actions">
          <button type="button" className="soft-circle" onClick={onRetake} aria-label="Back to sticker">
            <RotateCcw size={20} />
          </button>
          <button type="button" className="main-check" onClick={onAdd} aria-label="Add to today">
            <Check size={26} />
          </button>
          <button type="button" className="soft-circle" onClick={onDelete} aria-label="Delete">
            <X size={20} />
          </button>
        </div>

        <div className="nutrition-ribbon" aria-label="Nutrition estimate">
          <span>{analysis.type}</span>
          <strong>~{analysis.calories} kcal</strong>
          <span>{analysis.protein}g protein</span>
          <span>{analysis.fiber}g fiber</span>
        </div>

        <div className="ai-note">
          <Sparkles size={14} />
          <span>{analysis.note}</span>
        </div>
      </article>

      <button type="button" className="add-copy-button" onClick={onAdd}>
        加入今天
      </button>
    </section>
  );
}

function HistoryFlow({ history, onBack, onNew }) {
  const grouped = history.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return (
    <section className="history-flow">
      <TopDateBar onBack={onBack} />
      <button type="button" className="history-new-button" onClick={onNew} aria-label="New sticker">
        <Camera size={18} />
      </button>

      <div className="history-groups">
        {Object.entries(grouped).map(([date, items]) => (
          <section key={date} className="history-group">
            <h2>{date}</h2>
            <small>{items.length} 个事项</small>
            <div className="history-grid">
              {items.map((item) => (
                <article key={item.id} className={`history-item ${item.isCapture ? "is-capture" : ""}`}>
                  <StickerObject src={item.image} alt={item.name} />
                  <strong>{item.name}</strong>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function TopDateBar({ onBack, variant = "light" }) {
  return (
    <header className={`top-date-bar is-${variant}`}>
      <button type="button" onClick={onBack} aria-label="Back">
        <ChevronLeft size={21} />
      </button>
      <div>
        <strong>{todayLabel}</strong>
      </div>
      <span />
    </header>
  );
}

function FocusCorners({ hidden }) {
  return (
    <div className={`focus-corners ${hidden ? "is-hidden" : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function StickerObject({ alt, src }) {
  return (
    <div className="sticker-object">
      <img src={src} alt={alt} />
    </div>
  );
}

async function createCutout(file, onProgress) {
  const endpoint = import.meta.env.VITE_VILO_CUTOUT_ENDPOINT;
  if (endpoint) {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(endpoint, { method: "POST", body: formData });
    if (!response.ok) throw new Error("High quality cutout failed.");
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload.imageBase64) return dataUrlToBlob(payload.imageBase64);
      if (payload.imageUrl) return fetchBlob(payload.imageUrl);
    }
    return response.blob();
  }

  return removeBackground(file, {
    ...cutoutConfig,
    progress: (_key, current, total) => {
      if (!total) return;
      onProgress(Math.min(88, Math.round((current / total) * 72) + 10));
    },
  });
}

async function analyzeFood(file) {
  const endpoint = import.meta.env.VITE_VILO_ANALYZE_ENDPOINT;
  if (!endpoint) return fallbackAnalysis;

  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(endpoint, { method: "POST", body: formData });
  if (!response.ok) return fallbackAnalysis;
  const payload = await response.json();

  return {
    ...fallbackAnalysis,
    ...payload,
  };
}

async function cleanStickerBlob(blob) {
  const bitmap = await createBitmap(blob);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = bitmap.width;
  sourceCanvas.height = bitmap.height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(bitmap, 0, 0);

  const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alphaIndex = index + 3;
    const alpha = data[alphaIndex];

    if (alpha < 28) {
      data[alphaIndex] = 0;
      continue;
    }

    if (alpha < 188) {
      const normalized = (alpha - 28) / 160;
      data[alphaIndex] = Math.round(clamp(normalized ** 0.48, 0, 1) * 255);
    }

    if (data[alphaIndex] > 16) {
      const pixel = index / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  sourceContext.putImageData(imageData, 0, 0);
  if (minX >= maxX || minY >= maxY) return blob;

  const pad = Math.round(Math.max(width, height) * 0.05);
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
  const cropH = Math.min(height - cropY, maxY - minY + pad * 2);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = cropW;
  outputCanvas.height = cropH;
  const outputContext = outputCanvas.getContext("2d");
  outputContext.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return canvasToBlob(outputCanvas, "image/png", 1, blob);
}

function PhotoDissolve({ compact = false, src }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const cover = getCoverRect(image.width, image.height, rect.width, rect.height);
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = Math.max(1, Math.round(rect.width / (compact ? 4 : 3)));
      sampleCanvas.height = Math.max(1, Math.round(rect.height / (compact ? 4 : 3)));
      const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sampleContext.drawImage(
        image,
        cover.sx,
        cover.sy,
        cover.sw,
        cover.sh,
        0,
        0,
        sampleCanvas.width,
        sampleCanvas.height,
      );
      const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const step = compact ? 5 : 4;
      const particles = [];

      for (let y = 0; y < sampleCanvas.height; y += step) {
        for (let x = 0; x < sampleCanvas.width; x += step) {
          const index = (y * sampleCanvas.width + x) * 4;
          const keep = hash21(x, y);
          if (keep < 0.24) continue;
          particles.push({
            x: (x / sampleCanvas.width) * rect.width,
            y: (y / sampleCanvas.height) * rect.height,
            r: pixels[index],
            g: pixels[index + 1],
            b: pixels[index + 2],
            a: 0.58 + keep * 0.36,
            h1: hash21(x, y),
            h2: hash21(x + 127.1, y + 311.7),
            h3: hash21(x + 269.5, y + 183.3),
            h4: hash21(x + 419.2, y + 53.7),
          });
        }
      }

      const start = performance.now();
      const duration = compact ? 900 : 1450;

      function frame(now) {
        if (cancelled) return;
        const progress = clamp((now - start) / duration, 0, 1);
        context.clearRect(0, 0, rect.width, rect.height);

        for (const particle of particles) {
          const local = metalSweepProgress(particle, rect, progress);
          if (local <= 0) continue;
          const { x, y, alpha, size } = driftParticle(particle, local, compact ? 92 : 150);
          context.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${alpha})`;
          context.beginPath();
          context.arc(x, y, size, 0, Math.PI * 2);
          context.fill();
        }

        if (progress < 1) raf = requestAnimationFrame(frame);
      }

      raf = requestAnimationFrame(frame);
    };

    image.src = src;

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [compact, src]);

  return <canvas ref={canvasRef} className="photo-dissolve" aria-hidden="true" />;
}

function DissolveBurst({ src }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const sampleCanvas = document.createElement("canvas");
      const scale = Math.min(1, 210 / Math.max(image.width, image.height));
      sampleCanvas.width = Math.max(1, Math.round(image.width * scale));
      sampleCanvas.height = Math.max(1, Math.round(image.height * scale));
      const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sampleContext.drawImage(image, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const particles = [];
      const step = Math.max(3, Math.round(Math.max(sampleCanvas.width, sampleCanvas.height) / 56));

      for (let y = 0; y < sampleCanvas.height; y += step) {
        for (let x = 0; x < sampleCanvas.width; x += step) {
          const index = (y * sampleCanvas.width + x) * 4;
          const alpha = pixels[index + 3];
          const keep = hash21(x, y);
          if (alpha < 72 || keep < 0.48) continue;
          particles.push({
            x: (x / sampleCanvas.width) * rect.width,
            y: (y / sampleCanvas.height) * rect.height,
            r: pixels[index],
            g: pixels[index + 1],
            b: pixels[index + 2],
            a: alpha / 255,
            h1: hash21(x, y),
            h2: hash21(x + 127.1, y + 311.7),
            h3: hash21(x + 269.5, y + 183.3),
            h4: hash21(x + 419.2, y + 53.7),
          });
        }
      }

      const start = performance.now();
      const duration = 1280;

      function frame(now) {
        if (cancelled) return;
        const progress = clamp((now - start) / duration, 0, 1);
        context.clearRect(0, 0, rect.width, rect.height);

        for (const particle of particles) {
          const local = metalSweepProgress(particle, rect, progress);
          if (local <= 0) continue;
          const { x, y, alpha, size } = driftParticle(particle, local, 118);
          context.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${alpha})`;
          context.beginPath();
          context.arc(x, y, size, 0, Math.PI * 2);
          context.fill();
        }

        if (progress < 1) raf = requestAnimationFrame(frame);
      }

      raf = requestAnimationFrame(frame);
    };

    image.src = src;

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src]);

  return <canvas ref={canvasRef} className="dissolve-burst" aria-hidden="true" />;
}

function metalSweepProgress(particle, rect, progress) {
  const normalizedX = particle.x / rect.width;
  const normalizedY = particle.y / rect.height;
  const sweepPos = (normalizedX + (1 - normalizedY)) * 0.5;
  const startThreshold = sweepPos * 0.55 + particle.h1 * 0.3;
  return clamp((progress - startThreshold) / (1 - startThreshold + 0.01), 0, 1);
}

function driftParticle(particle, localProgress, distance) {
  const eased = localProgress ** 3;
  const baseAngle = -0.785398;
  const angle = baseAngle + (particle.h2 - 0.5) * 1.92;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const speed = 0.3 + particle.h3 * 1.4;
  const mag = eased * distance * speed;
  const wobble =
    Math.sin(localProgress * Math.PI * 2 + particle.h4 * Math.PI * 2) * (6 + particle.h4 * 12) * eased;
  return {
    x: particle.x + dirX * mag - dirY * wobble,
    y: particle.y + dirY * mag + dirX * wobble,
    alpha: (1 - smoothstep(0.05, 0.7, localProgress)) * particle.a,
    size: 1.3 + particle.h4 * 2.8,
  };
}

async function makeSampleBottleFile() {
  const blob = await fetchBlob(sampleBottlePhoto);
  return new File([blob], "vilo-sample-bottle.jpg", { type: blob.type || "image/jpeg" });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createBitmap(blob) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(blob);
  }

  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getCoverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const sw = sourceHeight * targetRatio;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  const sh = sourceWidth / targetRatio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}

async function fetchBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not fetch generated sticker.");
  return response.blob();
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl.includes(",")) {
    const binary = atob(dataUrl);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: "image/png" });
  }

  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function canvasToBlob(canvas, type, quality, fallback) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || fallback), type, quality);
  });
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash21(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

export default StickerLab;
