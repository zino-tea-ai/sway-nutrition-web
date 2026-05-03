import {
  Camera,
  Check,
  ChevronLeft,
  Crop,
  RotateCcw,
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
import {
  appendBoardSticker,
  createBoardStickerFromAnalysis,
  imageUrlToDataUrl,
} from "./stickerBoardData.js";
import { navigate } from "./Shell.jsx";
import "./sticker-lab.css";

const CUTOUT_ENDPOINT_STORAGE_KEY = "vilo.cutoutEndpoint";
const CUTOUT_MODEL_STORAGE_KEY = "vilo.cutoutModel";
const ANALYZE_ENDPOINT_STORAGE_KEY = "vilo.analyzeEndpoint";
const LOCAL_CUTOUT_ENDPOINT = "http://127.0.0.1:8787/api/cutout";
const LOCAL_ANALYZE_ENDPOINT = "http://127.0.0.1:8787/api/analyze-food";
const CUTOUT_MAX_SOURCE_EDGE = 1600;
const CUTOUT_UPLOAD_TYPE = "image/jpeg";
const CUTOUT_UPLOAD_QUALITY = 0.88;
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

let backgroundRemovalModulePromise;

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
  const analysisJobRef = useRef(0);
  const [phase, setPhase] = useState("camera");
  const [sourceUrl, setSourceUrl] = useState(null);
  const [stickerUrl, setStickerUrl] = useState(null);
  const [maskUrl, setMaskUrl] = useState(null);
  const [analysis, setAnalysis] = useState(fallbackAnalysis);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(seedHistory);
  const [burstKey, setBurstKey] = useState(0);
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (path === "/capture/confirm") {
      if (!stickerUrl) {
        navigate("/capture", { replace: true });
        return;
      }
      if (phase !== "confirm") setPhase("confirm");
    } else if (path === "/capture/detail") {
      if (!stickerUrl) {
        navigate("/capture", { replace: true });
        return;
      }
      if (phase !== "detail") setPhase("detail");
    } else if (path === "/capture") {
      if (phase === "confirm" || phase === "detail") {
        setPhase("camera");
      }
    }
  }, [path, stickerUrl]);

  useEffect(() => {
    const target =
      phase === "confirm" ? "/capture/confirm" : phase === "detail" ? "/capture/detail" : null;
    if (target && window.location.pathname !== target) {
      navigate(target);
    } else if (!target && window.location.pathname.startsWith("/capture/")) {
      navigate("/capture");
    }
  }, [phase]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => () => revokeUrl(sourceUrl), [sourceUrl]);

  useEffect(() => () => revokeUrl(stickerUrl), [stickerUrl]);

  useEffect(() => () => revokeUrl(maskUrl), [maskUrl]);

  useEffect(() => () => stopStream(cameraStream), [cameraStream]);

  async function processImage(file, options = {}) {
    if (!file) return;

    const jobId = analysisJobRef.current + 1;
    analysisJobRef.current = jobId;
    const previewUrl = URL.createObjectURL(file);
    setError("");
    setProgress(2);
    window.clearTimeout(revealTimerRef.current);
    revokeUrl(sourceUrl);
    revokeUrl(stickerUrl);
    revokeUrl(maskUrl);
    setSourceUrl(previewUrl);
    setStickerUrl(null);
    setMaskUrl(null);
    setAnalysis(fallbackAnalysis);
    setAnalysisPending(false);
    setPhase("cutting");

    const progressTimer = window.setInterval(() => {
      setProgress((value) => {
        if (value < 18) return Math.min(18, value + 5);
        if (value < 48) return Math.min(48, value + 3);
        if (value < 78) return Math.min(78, value + 2);
        return Math.min(94, value + 1);
      });
    }, 180);

    try {
      await delay(120);
      const workingFile = options.cutoutBlob ? file : await prepareImageFile(file);
      if (workingFile !== file) {
        const nextSourceUrl = URL.createObjectURL(workingFile);
        setSourceUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return nextSourceUrl;
        });
      }
      const cutoutTask = options.cutoutBlob
        ? Promise.resolve({ maskBlob: options.cutoutBlob })
        : createCutout(workingFile, (percent) => setProgress(percent));
      setAnalysisPending(Boolean(getConfiguredAnalyzeEndpoint()));
      analyzeFood(workingFile)
        .then((nextAnalysis) => {
          if (analysisJobRef.current === jobId) setAnalysis(nextAnalysis);
        })
        .catch(() => undefined)
        .finally(() => {
          if (analysisJobRef.current === jobId) setAnalysisPending(false);
        });
      const minimumCuttingMs = options.minimumCuttingMs ?? 1500;
      const [cutoutResult] = await Promise.all([
        cutoutTask,
        delay(minimumCuttingMs),
      ]);
      const { maskBlob, stickerBlob } = normalizeCutoutResult(cutoutResult);
      if (!maskBlob) throw new Error("Could not create the sticker.");
      const hasAlignedMask = await isAlignedCutoutMask(workingFile, maskBlob);
      const nextMaskUrl = hasAlignedMask ? URL.createObjectURL(maskBlob) : null;
      const cleanedBlob = stickerBlob || await cleanStickerBlob(maskBlob);
      const nextStickerUrl = URL.createObjectURL(cleanedBlob);
      setMaskUrl(nextMaskUrl);
      setStickerUrl(nextStickerUrl);
      setBurstKey((value) => value + 1);
      setProgress(100);
      setPhase("revealing");
      revealTimerRef.current = window.setTimeout(() => setPhase("confirm"), 1380);
    } catch (err) {
      analysisJobRef.current += 1;
      URL.revokeObjectURL(previewUrl);
      setError(err instanceof Error ? err.message : "Could not create the sticker.");
      setAnalysisPending(false);
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
          aspectRatio: { ideal: 3 / 4 },
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

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1440;
    if (!video.videoWidth || !video.videoHeight) return;

    const outputSize = fitWithin(width, height, CUTOUT_MAX_SOURCE_EDGE);
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height, 0, 0, outputSize.width, outputSize.height);
    const blob = await canvasToBlob(canvas, CUTOUT_UPLOAD_TYPE, CUTOUT_UPLOAD_QUALITY);
    if (!blob) return;
    stopCamera();
    processImage(new File([blob], `vilo-capture-${Date.now()}.jpg`, { type: CUTOUT_UPLOAD_TYPE }));
  }

  async function runSampleFlow() {
    const file = await makeSampleBottleFile();
    if (shouldUsePrebuiltSampleCutout()) {
      const cutoutBlob = await fetchBlob(sampleBottleCutout);
      processImage(file, { cutoutBlob, minimumCuttingMs: 1150 });
      return;
    }

    processImage(file, { minimumCuttingMs: 650 });
  }

  function resetFlow() {
    analysisJobRef.current += 1;
    stopCamera();
    window.clearTimeout(revealTimerRef.current);
    setPhase("camera");
    setProgress(0);
    setError("");
    revokeUrl(sourceUrl);
    revokeUrl(stickerUrl);
    revokeUrl(maskUrl);
    setSourceUrl(null);
    setStickerUrl(null);
    setMaskUrl(null);
    setAnalysis(fallbackAnalysis);
    setAnalysisPending(false);
  }

  function addToHistory() {
    if (!stickerUrl) return;
    const capturedAt = new Date();
    const id = `capture-${capturedAt.getTime()}`;
    setHistory((items) => [
      {
        id,
        date: todayLabel,
        image: stickerUrl,
        isCapture: true,
        name: analysis.name,
        localName: analysis.localName,
      },
      ...items,
    ]);
    persistStickerToBoard({ id, stickerUrl, analysis, capturedAt });
    navigate("/today");
  }

  function exitToToday() {
    analysisJobRef.current += 1;
    stopCamera();
    window.clearTimeout(revealTimerRef.current);
    revokeUrl(sourceUrl);
    revokeUrl(stickerUrl);
    revokeUrl(maskUrl);
    navigate("/today");
  }

  const commonProps = {
    analysis,
    analysisPending,
    burstKey,
    error,
    fileInputRef,
    progress,
    sourceUrl,
    stickerUrl,
    maskUrl,
    onBack: exitToToday,
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

        <FocusCorners hidden={false} />

        {phase === "cutting" && sourceUrl && (
          <div className="cutting-layer" aria-live="polite" aria-label={`Preparing sticker ${progress}%`} />
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
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error && <p className="camera-error">{error}</p>}
    </section>
  );
}

function ConfirmFlow({ burstKey, isRevealing, maskUrl, onBack, onConfirm, onRetake, sourceUrl, stickerUrl }) {
  return (
    <section className={`confirm-flow ${isRevealing ? "is-revealing" : ""}`}>
      <TopDateBar onBack={onBack} variant="dark" />

      {(isRevealing || maskUrl) && (
        <div className="confirm-source-frame">
          {isRevealing && sourceUrl && (
            <PhotoDissolve key={`confirm-${sourceUrl}-${maskUrl || "full"}`} src={sourceUrl} maskSrc={maskUrl} compact />
          )}
          {maskUrl && <LiftedSubjectFrame src={maskUrl} aligned isRevealing={isRevealing} />}
        </div>
      )}

      <div className="confirm-stage">
        {!maskUrl && !isRevealing && stickerUrl && (
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

function LiftedSubjectFrame({ aligned, isRevealing, src }) {
  return (
    <div
      className={`lifted-subject-frame ${aligned ? "is-aligned" : "is-cropped"} ${isRevealing ? "is-revealing" : ""}`}
      aria-hidden="true"
    >
      <img src={src} alt="" />
    </div>
  );
}

function DetailFlow({ analysis, analysisPending, onAdd, onBack, onDelete, onRetake, stickerUrl }) {
  const visibleAnalysis = analysisPending
    ? {
        ...analysis,
        name: "Food sticker",
        localName: "食物贴纸",
        type: "待确认",
        note: "可以先保存，名称和营养信息会自动补全。",
      }
    : analysis;

  return (
    <section className="detail-flow">
      <TopDateBar onBack={onBack} />

      <article className="sticker-detail-card">
        <div className="detail-aura" />
        <div className="detail-sticker">
          {stickerUrl && <StickerObject src={stickerUrl} alt={analysis.name} />}
        </div>

        <div className="detail-title-row">
          <h1>{visibleAnalysis.name}</h1>
          <button type="button" className="sound-button" aria-label="Listen">
            <Volume2 size={16} />
          </button>
        </div>
        <p>{visibleAnalysis.localName}</p>

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
          <span>{visibleAnalysis.type}</span>
          <strong>~{visibleAnalysis.calories} kcal</strong>
          <span>{visibleAnalysis.protein}g protein</span>
          <span>{visibleAnalysis.fiber}g fiber</span>
        </div>

        <div className={`ai-note ${analysisPending ? "is-pending" : ""}`}>
          <Sparkles size={14} />
          <span>{visibleAnalysis.note}</span>
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

async function persistStickerToBoard({ id, stickerUrl, analysis, capturedAt }) {
  try {
    const image = await imageUrlToDataUrl(stickerUrl);
    appendBoardSticker(createBoardStickerFromAnalysis({ id, image, analysis, capturedAt }));
  } catch (err) {
    console.info("Could not persist sticker board item.", err);
  }
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
  const configuredEndpoint = getConfiguredCutoutEndpoint();
  const endpoint = configuredEndpoint || (import.meta.env.DEV ? LOCAL_CUTOUT_ENDPOINT : "");
  if (endpoint) {
    try {
      return await createRemoteCutout(endpoint, file, onProgress);
    } catch (err) {
      if (configuredEndpoint) throw err;
      console.info("Cutout API unavailable; falling back to browser model.");
    }
  }

  const { removeBackground } = await loadBackgroundRemoval();
  const maskBlob = await removeBackground(file, {
    ...cutoutConfig,
    progress: (_key, current, total) => {
      if (!total) return;
      onProgress(Math.min(92, Math.round((current / total) * 62) + 24));
    },
  });
  return { maskBlob };
}

function normalizeCutoutResult(result) {
  if (result instanceof Blob) return { maskBlob: result, stickerBlob: null };
  return {
    maskBlob: result?.maskBlob || result?.blob || null,
    stickerBlob: result?.stickerBlob || null,
  };
}

async function loadBackgroundRemoval() {
  backgroundRemovalModulePromise ||= import("@imgly/background-removal");
  return backgroundRemovalModulePromise;
}

async function createRemoteCutout(endpoint, file, onProgress) {
  onProgress(38);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(resolveCutoutEndpoint(endpoint), {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    onProgress(76);
    if (!response.ok) throw new Error("High quality cutout failed.");
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      const maskBlob = payload.mask?.imageBase64
        ? dataUrlToBlob(payload.mask.imageBase64, payload.mask.mime)
        : payload.imageBase64
          ? dataUrlToBlob(payload.imageBase64)
          : null;
      const stickerBlob = payload.sticker?.imageBase64
        ? dataUrlToBlob(payload.sticker.imageBase64, payload.sticker.mime)
        : null;
      if (maskBlob || stickerBlob) {
        return {
          maskBlob: maskBlob || stickerBlob,
          stickerBlob,
        };
      }
      if (payload.imageUrl) return { maskBlob: await fetchBlob(payload.imageUrl) };
      throw new Error(payload.error || "High quality cutout failed.");
    }
    return { maskBlob: await response.blob() };
  } finally {
    window.clearTimeout(timeout);
  }
}

function resolveCutoutEndpoint(endpoint) {
  const url = new URL(endpoint, window.location.href);
  const model = getConfiguredCutoutModel();
  if (model) url.searchParams.set("model", model);
  url.searchParams.set("response", "json");
  return url.toString();
}

function getConfiguredCutoutEndpoint() {
  const runtimeEndpoint = readRuntimeSetting("cutoutEndpoint", CUTOUT_ENDPOINT_STORAGE_KEY);
  return normalizeHttpEndpoint(runtimeEndpoint || import.meta.env.VITE_VILO_CUTOUT_ENDPOINT || "");
}

function getConfiguredCutoutModel() {
  return readRuntimeSetting("cutoutModel", CUTOUT_MODEL_STORAGE_KEY) || import.meta.env.VITE_VILO_REMOTE_CUTOUT_MODEL || "";
}

function readRuntimeSetting(queryName, storageKey) {
  const params = new URLSearchParams(window.location.search);
  if (params.has(queryName)) {
    const value = (params.get(queryName) || "").trim();
    if (value) {
      window.localStorage?.setItem(storageKey, value);
    } else {
      window.localStorage?.removeItem(storageKey);
    }
    return value;
  }

  return window.localStorage?.getItem(storageKey) || "";
}

function normalizeHttpEndpoint(value) {
  if (!value) return "";

  try {
    const url = new URL(value, window.location.href);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function analyzeFood(file) {
  const endpoint = getConfiguredAnalyzeEndpoint();
  if (!endpoint) return fallbackAnalysis;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 26000);
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) return fallbackAnalysis;
    const payload = await response.json();

    return normalizeAnalysisPayload(payload);
  } catch {
    return fallbackAnalysis;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeAnalysisPayload(payload) {
  return {
    ...fallbackAnalysis,
    ...payload,
    calories: asNumber(payload?.calories, fallbackAnalysis.calories),
    protein: asNumber(payload?.protein, fallbackAnalysis.protein),
    fiber: asNumber(payload?.fiber, fallbackAnalysis.fiber),
    confidence: asNumber(payload?.confidence, fallbackAnalysis.confidence),
  };
}

function asNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getConfiguredAnalyzeEndpoint() {
  const runtimeEndpoint = readRuntimeSetting("analyzeEndpoint", ANALYZE_ENDPOINT_STORAGE_KEY);
  const explicitEndpoint = normalizeHttpEndpoint(runtimeEndpoint || import.meta.env.VITE_VILO_ANALYZE_ENDPOINT || "");
  if (explicitEndpoint) return explicitEndpoint;

  const inferredEndpoint = inferAnalyzeEndpoint(getConfiguredCutoutEndpoint());
  if (inferredEndpoint) return inferredEndpoint;

  if (import.meta.env.DEV) return LOCAL_ANALYZE_ENDPOINT;
  if (shouldUseSameOriginApi()) return "/api/analyze-food";
  return "";
}

function shouldUseSameOriginApi() {
  return Boolean(window.location.hostname && !window.location.hostname.endsWith("github.io"));
}

function inferAnalyzeEndpoint(cutoutEndpoint) {
  if (!cutoutEndpoint) return "";
  try {
    const url = new URL(cutoutEndpoint, window.location.href);
    const nextPath = url.pathname.replace(/\/api\/cutout\/?$/, "/api/analyze-food");
    if (nextPath === url.pathname) return "";
    url.pathname = nextPath;
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
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

async function isAlignedCutoutMask(sourceBlob, cutoutBlob) {
  let sourceBitmap;
  let cutoutBitmap;

  try {
    [sourceBitmap, cutoutBitmap] = await Promise.all([createBitmap(sourceBlob), createBitmap(cutoutBlob)]);
    const sourceRatio = sourceBitmap.width / sourceBitmap.height;
    const cutoutRatio = cutoutBitmap.width / cutoutBitmap.height;
    const ratioDelta = Math.abs(sourceRatio - cutoutRatio);
    const widthDelta = Math.abs(sourceBitmap.width - cutoutBitmap.width) / sourceBitmap.width;
    const heightDelta = Math.abs(sourceBitmap.height - cutoutBitmap.height) / sourceBitmap.height;
    return ratioDelta < 0.02 && widthDelta < 0.03 && heightDelta < 0.03;
  } catch {
    return false;
  } finally {
    sourceBitmap?.close?.();
    cutoutBitmap?.close?.();
  }
}

function PhotoDissolve({ compact = false, maskSrc, src }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let resources = null;

    runMetalDissolve(canvasRef.current, { compact, maskSrc, src }, (nextRaf) => {
      raf = nextRaf;
    }).then((nextResources) => {
      resources = nextResources;
      if (cancelled) {
        cleanupWebGLResources(resources);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupWebGLResources(resources);
    };
  }, [compact, maskSrc, src]);

  return <canvas ref={canvasRef} className="photo-dissolve" aria-hidden="true" />;
}

const dissolveVertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = vec2((a_position.x + 1.0) * 0.5, 1.0 - (a_position.y + 1.0) * 0.5);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const dissolveFragmentShaderSource = `
  precision highp float;

  uniform sampler2D u_image;
  uniform sampler2D u_mask;
  uniform vec2 u_canvasSize;
  uniform vec2 u_imageSize;
  uniform float u_progress;
  uniform float u_useMask;
  varying vec2 v_uv;

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float smoothCut(float edge0, float edge1, float value) {
    float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }

  vec2 coverUv(vec2 uv, vec2 sourceSize, vec2 targetSize) {
    float sourceRatio = sourceSize.x / sourceSize.y;
    float targetRatio = targetSize.x / targetSize.y;

    if (sourceRatio > targetRatio) {
      float visibleWidth = targetRatio / sourceRatio;
      return vec2((1.0 - visibleWidth) * 0.5 + uv.x * visibleWidth, uv.y);
    }

    float visibleHeight = sourceRatio / targetRatio;
    return vec2(uv.x, (1.0 - visibleHeight) * 0.5 + uv.y * visibleHeight);
  }

  void main() {
    float progress = clamp(u_progress, 0.0, 1.0);
    vec2 position = v_uv * u_canvasSize;
    vec2 blockID = floor(position);
    float r1 = hash21(blockID);
    float r2 = hash21(blockID + vec2(127.1, 311.7));
    float r3 = hash21(blockID + vec2(269.5, 183.3));
    float r4 = hash21(blockID + vec2(419.2, 53.7));

    float sweepPos = (v_uv.x + (1.0 - v_uv.y)) * 0.5;
    float startThreshold = sweepPos * 0.55 + r1 * 0.30;
    float localProgress = clamp((progress - startThreshold) / (1.0 - startThreshold + 0.01), 0.0, 1.0);
    float eased = localProgress * localProgress * localProgress;

    float baseAngle = -0.785398;
    float angleVariation = (r2 - 0.5) * 1.92;
    float angle = baseAngle + angleVariation;
    vec2 dir = vec2(cos(angle), sin(angle));
    float speed = 0.3 + r3 * 1.4;
    float mag = eased * 200.0 * speed;
    float wobble = sin(localProgress * 6.28 + r4 * 6.28) * (8.0 + r4 * 12.0) * eased;
    vec2 perpDir = vec2(-dir.y, dir.x);
    vec2 samplePos = position - (dir * mag + perpDir * wobble);

    if (samplePos.x < 0.0 || samplePos.x > u_canvasSize.x || samplePos.y < 0.0 || samplePos.y > u_canvasSize.y) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 imageUv = coverUv(samplePos / u_canvasSize, u_imageSize, u_canvasSize);
    vec2 textureUv = vec2(imageUv.x, 1.0 - imageUv.y);
    vec4 color = texture2D(u_image, textureUv);
    float maskAlpha = u_useMask > 0.5 ? texture2D(u_mask, textureUv).a : 0.0;
    float subjectWeight = smoothCut(0.18, 0.72, maskAlpha);
    float alphaFade = 1.0 - smoothCut(0.05, 0.7, localProgress);
    float subjectFade = 1.0 - smoothCut(0.0, 0.12, progress);

    color.a *= max((1.0 - subjectWeight) * alphaFade, subjectWeight * subjectFade);
    gl_FragColor = color;
  }
`;

async function runMetalDissolve(canvas, { compact, maskSrc, src }, setRaf) {
  if (!canvas) return null;

  try {
    const [image, mask] = await Promise.all([
      loadImage(src),
      maskSrc ? loadImage(maskSrc).catch(() => null) : Promise.resolve(null),
    ]);
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      stencil: false,
    });
    if (!gl) return null;

    const program = createWebGLProgram(gl, dissolveVertexShaderSource, dissolveFragmentShaderSource);
    if (!program) return null;

    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const imageTexture = createImageTexture(gl, image);
    const maskTexture = mask ? createImageTexture(gl, mask) : createTransparentTexture(gl);
    const useMask = mask && Math.abs(image.width / image.height - mask.width / mask.height) < 0.02 ? 1 : 0;
    const locations = {
      position: gl.getAttribLocation(program, "a_position"),
      image: gl.getUniformLocation(program, "u_image"),
      mask: gl.getUniformLocation(program, "u_mask"),
      canvasSize: gl.getUniformLocation(program, "u_canvasSize"),
      imageSize: gl.getUniformLocation(program, "u_imageSize"),
      progress: gl.getUniformLocation(program, "u_progress"),
      useMask: gl.getUniformLocation(program, "u_useMask"),
    };

    gl.useProgram(program);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.uniform1i(locations.image, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(locations.mask, 1);
    gl.uniform2f(locations.canvasSize, canvas.width, canvas.height);
    gl.uniform2f(locations.imageSize, image.width, image.height);
    gl.uniform1f(locations.useMask, useMask);

    const start = performance.now();
    const duration = compact ? 1080 : 1450;
    const resources = { buffer, gl, program, textures: [imageTexture, maskTexture] };

    function frame(now) {
      const progress = clamp((now - start) / duration, 0, 1);
      const shaderProgress = 1 - (1 - progress) ** 1.8;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(locations.progress, shaderProgress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (progress < 1) {
        const nextRaf = requestAnimationFrame(frame);
        setRaf(nextRaf);
      }
    }

    const nextRaf = requestAnimationFrame(frame);
    setRaf(nextRaf);
    return resources;
  } catch (err) {
    console.info("Metal-style dissolve unavailable.", err);
    return null;
  }
}

function createWebGLProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createWebGLShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createWebGLShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.info(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function createWebGLShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.info(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createImageTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function createTransparentTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function cleanupWebGLResources(resources) {
  if (!resources?.gl) return;
  for (const texture of resources.textures || []) {
    if (texture) resources.gl.deleteTexture(texture);
  }
  if (resources.buffer) resources.gl.deleteBuffer(resources.buffer);
  if (resources.program) resources.gl.deleteProgram(resources.program);
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

function fitWithin(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function prepareImageFile(file) {
  if (!file?.type?.startsWith("image/")) return file;

  let bitmap;
  try {
    bitmap = await createBitmap(file);
  } catch {
    return file;
  }

  try {
    const outputSize = fitWithin(bitmap.width, bitmap.height, CUTOUT_MAX_SOURCE_EDGE);
    const alreadySmallJpeg =
      outputSize.width === bitmap.width &&
      outputSize.height === bitmap.height &&
      file.type === CUTOUT_UPLOAD_TYPE;
    if (alreadySmallJpeg) return file;

    const canvas = document.createElement("canvas");
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, outputSize.width, outputSize.height);
    const blob = await canvasToBlob(canvas, CUTOUT_UPLOAD_TYPE, CUTOUT_UPLOAD_QUALITY, file);
    if (blob === file) return file;

    const name = file.name?.replace(/\.[^.]+$/, ".jpg") || `vilo-photo-${Date.now()}.jpg`;
    return new File([blob], name, { type: blob.type || CUTOUT_UPLOAD_TYPE, lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}

async function fetchBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not fetch generated sticker.");
  return response.blob();
}

function dataUrlToBlob(dataUrl, fallbackMime = "image/png") {
  if (!dataUrl.includes(",")) {
    const binary = atob(dataUrl);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: fallbackMime });
  }

  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || fallbackMime;
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

function shouldUsePrebuiltSampleCutout() {
  return !new URLSearchParams(window.location.search).has("remoteSample");
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function revokeUrl(url) {
  if (url) URL.revokeObjectURL(url);
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
