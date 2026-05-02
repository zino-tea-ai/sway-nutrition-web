import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import StickerLab from "./StickerLab.jsx";
import "./styles.css";

const basePath = import.meta.env.BASE_URL || "/";
const normalizedPath = window.location.pathname.startsWith(basePath)
  ? `/${window.location.pathname.slice(basePath.length)}`
  : window.location.pathname;

const Root =
  import.meta.env.VITE_STICKER_LAB_ONLY === "true" ||
  normalizedPath.startsWith("/sticker-lab")
    ? StickerLab
    : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
