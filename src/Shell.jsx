import { Camera, Layers, User } from "lucide-react";
import React, { Suspense, lazy, useEffect, useSyncExternalStore } from "react";
import HomeStructure from "./HomeStructure.jsx";
import StickerBoard from "./StickerBoard.jsx";
import StickerLab from "./StickerLab.jsx";
import "./shell.css";

// Legacy Sway app is loaded only when /legacy is hit, so its global
// styles do not pollute the new Vilo app surfaces.
const LegacyApp = lazy(() => import("./App.jsx"));

const rawBase = import.meta.env.BASE_URL || "/";
const basePath = rawBase.replace(/\/$/, "");

function normalizePath(pathname) {
  if (basePath && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname;
}

export function navigate(to, { replace = false } = {}) {
  const fullPath = `${basePath}${to}`;
  if (replace) {
    window.history.replaceState({}, "", fullPath);
  } else {
    window.history.pushState({}, "", fullPath);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function subscribePopstate(cb) {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

function getCurrentPath() {
  return normalizePath(window.location.pathname);
}

function usePath() {
  return useSyncExternalStore(subscribePopstate, getCurrentPath, getCurrentPath);
}

const TABS = [
  { id: "today", label: "Today", path: "/today", icon: Layers },
  { id: "capture", label: "Scan", path: "/capture", icon: Camera, isAction: true },
  { id: "you", label: "You", path: "/you", icon: User },
];

function isStandaloneApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function Shell() {
  const path = usePath();

  useEffect(() => {
    if (import.meta.env.VITE_STICKER_LAB_ONLY === "true") {
      if (!path.startsWith("/capture")) navigate("/capture", { replace: true });
      return;
    }
    if (isStandaloneApp() && path === "/today") {
      navigate("/home-structure", { replace: true });
      return;
    }
    if (path === "/" || path === "") {
      navigate("/home-structure", { replace: true });
      return;
    }
    if (path === "/sticker-lab" || path.startsWith("/sticker-lab/")) {
      navigate(path.replace(/^\/sticker-lab/, "/capture"), { replace: true });
      return;
    }
    if (path === "/sticker-board" || path.startsWith("/sticker-board/")) {
      navigate(path.replace(/^\/sticker-board/, "/today"), { replace: true });
      return;
    }
  }, [path]);

  if (path === "/legacy") {
    return (
      <Suspense fallback={null}>
        <LegacyApp />
      </Suspense>
    );
  }

  return <AppShell path={path} />;
}

function AppShell({ path }) {
  const isCapture = path === "/capture" || path.startsWith("/capture/");
  const isCaptureRoot = path === "/capture";
  const isToday = path === "/today";
  const isHomeStructure = path === "/home-structure";
  const isYou = path === "/you";

  const showTabBar = isToday || isCaptureRoot || isYou;

  return (
    <div className="app-shell-frame">
      <div className="app-shell-content">
        {isCapture && <StickerLab />}
        {isToday && <StickerBoard />}
        {isHomeStructure && <HomeStructure />}
        {isYou && <YouView />}
        {!isCapture && !isToday && !isHomeStructure && !isYou && <NotFound path={path} />}
      </div>
      {showTabBar && <TabBar path={path} />}
    </div>
  );
}

function TabBar({ path }) {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          path === tab.path || (tab.path === "/capture" && path.startsWith("/capture/"));

        if (tab.isAction) {
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab-action ${active ? "is-active" : ""}`}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={26} strokeWidth={2.2} />
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-item ${active ? "is-active" : ""}`}
            onClick={() => navigate(tab.path)}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={1.9} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function YouView() {
  return (
    <main className="you-view">
      <header className="you-view-head">
        <p className="eyebrow">You</p>
        <h1>Profile</h1>
      </header>
      <section className="you-placeholder">
        <p>This area will hold the account and preference system:</p>
        <ul>
          <li>Primary and secondary goals</li>
          <li>Units and reminders</li>
          <li>History and exports</li>
          <li>App settings</li>
        </ul>
      </section>
    </main>
  );
}

function NotFound({ path }) {
  return (
    <main className="you-view">
      <header className="you-view-head">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
      </header>
      <section className="you-placeholder">
        <p>
          Path <code>{path}</code> is not in the current route table.
        </p>
        <button type="button" className="ghost-button" onClick={() => navigate("/today")}>
          Back to Today
        </button>
      </section>
    </main>
  );
}

export default Shell;
