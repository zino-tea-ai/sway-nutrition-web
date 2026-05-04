import {
  Camera,
  Droplets,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { GOAL_ACTIONS, GOAL_CATALOG } from "./design/goalCatalog.js";
import {
  STICKER_BOARD_UPDATED_EVENT,
  formatSigned,
  getGoalImpact,
  loadBoardItems,
  nextBoardMove,
  summarizeGoal,
} from "./stickerBoardData.js";
import "./sticker-board.css";

function StickerBoard() {
  const [items, setItems] = useState(() => loadBoardItems());
  const [activeGoalId, setActiveGoalId] = useState("energy");
  const [waterMl, setWaterMl] = useState(1600);

  useEffect(() => {
    const refresh = () => setItems(loadBoardItems());
    window.addEventListener("storage", refresh);
    window.addEventListener(STICKER_BOARD_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STICKER_BOARD_UPDATED_EVENT, refresh);
    };
  }, []);

  const activeGoal = GOAL_CATALOG.find((goal) => goal.id === activeGoalId) || GOAL_CATALOG[3];
  const goalSummary = useMemo(
    () => summarizeGoal(items, activeGoal.metricGoalId),
    [activeGoal.metricGoalId, items],
  );
  const selectedItems = items.slice(0, 6);
  const meals = items.slice(0, 4);
  const score = useMemo(() => scoreFromSummary(goalSummary), [goalSummary]);
  const signals = useMemo(() => buildSignals(items, waterMl, activeGoal), [activeGoal, items, waterMl]);
  const actions = GOAL_ACTIONS[activeGoal.id] || GOAL_ACTIONS.energy;
  const primaryAction = actions[0];
  const move = nextBoardMove(items, [activeGoal.metricGoalId]);

  return (
    <main className="home-page">
      <section className="home-phone" aria-label="Vilo home">
        <header className="home-topbar">
          <div>
            <span>{formatToday()}</span>
            <strong>vilo</strong>
          </div>
          <button type="button" className="icon-button" aria-label="Ask Vilo">
            <Sparkles size={18} />
          </button>
        </header>

        <nav className="goal-rail" aria-label="Primary goal">
          {GOAL_CATALOG.map((goal) => {
            const Icon = goal.Icon;
            return (
              <button
                key={goal.id}
                type="button"
                className={goal.id === activeGoal.id ? "is-active" : ""}
                onClick={() => setActiveGoalId(goal.id)}
                aria-pressed={goal.id === activeGoal.id}
              >
                <Icon size={14} />
                <span>{goal.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="hero-stage" aria-label={`${activeGoal.label} status`}>
          <div className="hero-copy">
            <span className="hero-kicker">{activeGoal.label} goal</span>
            <h1>{activeGoal.headline}</h1>
            <p>{activeGoal.subline}</p>
          </div>

          <div className="score-orb" aria-label={`${score} Vilo score`}>
            <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
              <circle className="score-track" cx="60" cy="60" r="52" />
              <circle
                className="score-fill"
                cx="60"
                cy="60"
                r="52"
                pathLength="100"
                style={{ "--score": score }}
              />
            </svg>
            <strong>{score}</strong>
            <span>{activeGoal.status}</span>
          </div>

          <div className="sticker-cloud" aria-label="Today food stickers">
            {selectedItems.map((item, index) => (
              <FoodSticker key={item.id} item={item} index={index} goalId={activeGoal.metricGoalId} />
            ))}
          </div>
        </section>

        <section className="home-action-bar" aria-label="Quick actions">
          <ActionButton icon={Camera} label="Scan" onClick={() => navigateLocal("/capture")} />
          <ActionButton icon={Droplets} label={`${Math.round(waterMl / 100) / 10} L water`} onClick={() => setWaterMl((value) => Math.min(value + 350, 2800))} />
          <ActionButton icon={MessageCircle} label="Ask" />
        </section>

        <section className="home-content" aria-label="Today plan">
          <article className="story-card next-card">
            <StickerLabel item={selectedItems[0]} caption="next" />
            <div className="story-card-copy">
              <span>Next best move</span>
              <h2>{primaryAction.label}</h2>
              <p>{primaryAction.detail}</p>
            </div>
            <div className="story-card-foot">
              <strong>{primaryAction.value}</strong>
              <button type="button" onClick={() => handleAction(primaryAction, setWaterMl)}>
                {primaryAction.action}
              </button>
            </div>
            <div className="quiet-actions" aria-label="Secondary actions">
              {actions.slice(1).map((action) => (
                <button key={action.id} type="button" onClick={() => handleAction(action, setWaterMl)}>
                  <span>{action.label}</span>
                  <b>{action.value}</b>
                </button>
              ))}
            </div>
          </article>

          <article className="story-card signal-story">
            <StickerLabel item={selectedItems[1]} caption={move.label} />
            <div className="story-card-copy">
              <span>Macro / micro lens</span>
              <h2>{activeGoal.label} signals</h2>
              <p>Only the signals that explain today's score stay on the surface.</p>
            </div>
            <div className="signal-river">
              {signals.slice(0, 4).map((signal) => (
                <SignalPill key={signal.label} signal={signal} />
              ))}
            </div>
          </article>

          <article className="story-card meal-story">
            <StickerLabel item={selectedItems[2]} caption={`${items.length} logged`} />
            <div className="story-card-copy">
              <span>Today intake</span>
              <h2>Sticker trail</h2>
              <p>Your meals become a soft collection for the day, not a spreadsheet.</p>
            </div>
            <div className="meal-strip">
              {meals.map((item) => (
                <MealToken key={item.id} item={item} goalId={activeGoal.metricGoalId} />
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function FoodSticker({ item, index, goalId }) {
  const impact = getGoalImpact(item, goalId);
  return (
    <article className={`food-sticker food-sticker-${index + 1}`} style={{ "--float-delay": `${index * -0.9}s` }}>
      <img src={item.image} alt="" />
      <span>{item.localName || item.name}</span>
      <b className={impact.isHelpful ? "is-good" : "is-watch"}>{formatSigned(impact.points)}</b>
    </article>
  );
}

function StickerLabel({ item, caption }) {
  if (!item) return null;
  return (
    <div className="sticker-label" aria-hidden="true">
      <img src={item.image} alt="" />
      <span>{caption}</span>
    </div>
  );
}

function SignalPill({ signal }) {
  return (
    <div className={`signal-pill ${signal.kind}`}>
      <span>{signal.type}</span>
      <strong>{signal.value}</strong>
      <p>{signal.label}</p>
    </div>
  );
}

function MealToken({ item, goalId }) {
  const impact = getGoalImpact(item, goalId);
  return (
    <button type="button" className="meal-token">
      <img src={item.image} alt="" />
      <span>{item.time || "Today"}</span>
      <b className={impact.isHelpful ? "is-good" : "is-watch"}>{formatSigned(impact.points)}</b>
    </button>
  );
}

function buildSignals(items, waterMl, activeGoal) {
  const totals = items.reduce(
    (sum, item) => {
      const attrs = item.attributes || {};
      return {
        kcal: sum.kcal + (Number(item.kcal) || 0),
        protein: sum.protein + (Number(attrs.protein) || 0),
        fresh: sum.fresh + (Number(attrs.fresh) || 0),
        sweet: sum.sweet + (Number(attrs.sweet) || 0),
      };
    },
    { kcal: 0, protein: 0, fresh: 0, sweet: 0 },
  );

  const protein = Math.max(38, Math.round(totals.protein * 18 + 22));
  const fiber = Math.max(12, Math.round(totals.fresh * 3.5 + 8));
  const sugar = totals.sweet >= 4 ? "Watch" : totals.sweet >= 2 ? "Moderate" : "Low";

  return [
    { type: "Macro", value: `${Math.round(totals.kcal || 1350)} kcal`, label: "Energy in", kind: "neutral" },
    { type: "Macro", value: `${protein} g`, label: "Protein", kind: "good" },
    { type: "Micro", value: `${fiber} g`, label: "Fiber", kind: "good" },
    { type: "Micro", value: `${Math.round(waterMl / 100) / 10} L`, label: "Hydration", kind: waterMl >= 2000 ? "good" : "neutral" },
    { type: "Signal", value: sugar, label: "Sugar load", kind: sugar === "Low" ? "good" : "watch" },
    { type: "Goal", value: activeGoal.label, label: activeGoal.status, kind: "neutral" },
  ];
}

function scoreFromSummary(summary) {
  const directionTotal = summary.goal.better === "higher" ? summary.total : -summary.total;
  return clamp(Math.round(78 + directionTotal * 1.8), 48, 96);
}

function handleAction(action, setWaterMl) {
  if (action.id === "water") {
    setWaterMl((value) => Math.min(value + 350, 2800));
    return;
  }
  if (action.action === "Scan") {
    navigateLocal("/capture");
  }
}

function navigateLocal(to) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default StickerBoard;
