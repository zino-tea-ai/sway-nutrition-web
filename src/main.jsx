import React from "react";
import { createRoot } from "react-dom/client";
import Shell from "./Shell.jsx";
import "./design/tokens.css";
import "./global.css";
import "./design/mobile-shell.css";
import "./design/components.css";
import "./design/sticker.css";

syncThemeColor();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);

function syncThemeColor() {
  const pageColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--vilo-color-page")
    .trim();

  if (!pageColor) return;

  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", pageColor));

  document.documentElement.style.backgroundColor = pageColor;
  document.body.style.backgroundColor = pageColor;
}
