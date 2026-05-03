import { Camera, Layers, User } from "lucide-react";
import React, { useEffect, useSyncExternalStore } from "react";
import App from "./App.jsx";
import StickerBoard from "./StickerBoard.jsx";
import StickerLab from "./StickerLab.jsx";
import { STICKER_BOARD_STORAGE_KEY } from "./stickerBoardData.js";
import "./shell.css";

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

function hasAnyStickers() {
  try {
    const raw = window.localStorage.getItem(STICKER_BOARD_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

const TABS = [
  { id: "today", label: "今天", path: "/today", icon: Layers },
  { id: "capture", label: "拍", path: "/capture", icon: Camera, isAction: true },
  { id: "you", label: "我", path: "/you", icon: User },
];

function Shell() {
  const path = usePath();

  useEffect(() => {
    if (import.meta.env.VITE_STICKER_LAB_ONLY === "true") {
      if (!path.startsWith("/capture")) navigate("/capture", { replace: true });
      return;
    }
    if (path === "/" || path === "") {
      navigate(hasAnyStickers() ? "/today" : "/capture", { replace: true });
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
    return <App />;
  }

  return <AppShell path={path} />;
}

function AppShell({ path }) {
  const isCapture = path === "/capture" || path.startsWith("/capture/");
  const isToday = path === "/today";
  const isYou = path === "/you";

  const showTabBar = isToday || isYou;

  return (
    <div className="app-shell-frame">
      <div className="app-shell-content">
        {isCapture && <StickerLab />}
        {isToday && <StickerBoard />}
        {isYou && <YouView />}
        {!isCapture && !isToday && !isYou && <NotFound path={path} />}
      </div>
      {showTabBar && <TabBar path={path} />}
    </div>
  );
}

function TabBar({ path }) {
  return (
    <nav className="tab-bar" role="tablist" aria-label="主导航">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          path === tab.path || (tab.path === "/capture" && path.startsWith("/capture/"));

        if (tab.isAction) {
          return (
            <button
              key={tab.id}
              type="button"
              className="tab-action"
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
            >
              <Icon size={26} strokeWidth={2.2} />
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab-item ${active ? "is-active" : ""}`}
            onClick={() => navigate(tab.path)}
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
        <p className="eyebrow">我</p>
        <h1>设置</h1>
      </header>
      <section className="you-placeholder">
        <p>这里之后放：</p>
        <ul>
          <li>要追踪的目标（体重 / 能量 / 肠胃 / 睡眠 …）</li>
          <li>单位偏好</li>
          <li>历史 / 导出</li>
          <li>关于</li>
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
        <h1>没有这一页</h1>
      </header>
      <section className="you-placeholder">
        <p>路径 <code>{path}</code> 不在当前路由表里。</p>
        <button type="button" className="ghost-button" onClick={() => navigate("/today")}>
          回今天
        </button>
      </section>
    </main>
  );
}

export default Shell;
