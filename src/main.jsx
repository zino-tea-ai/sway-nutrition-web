import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import StickerLab from "./StickerLab.jsx";
import "./styles.css";

const Root =
  import.meta.env.VITE_STICKER_LAB_ONLY === "true" ||
  window.location.pathname.startsWith("/sticker-lab")
    ? StickerLab
    : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
