import {
  BarChart3,
  CalendarDays,
  Flame,
  Layers,
  MessageCircle,
  MoreHorizontal,
  ScanLine,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import React, { useMemo } from "react";

import { GOAL_CATALOG } from "./design/goalCatalog.js";
import {
  formatSigned,
  getGoalImpact,
  loadBoardItems,
  summarizeGoal,
} from "./stickerBoardData.js";
import "./home-structure.css";

function HomeStructure() {
  const items = useMemo(() => loadBoardItems(), []);
  const goal = GOAL_CATALOG.find((entry) => entry.id === "energy") || GOAL_CATALOG[0];
  const summary = useMemo(() => summarizeGoal(items, goal.metricGoalId), [goal.metricGoalId, items]);
  const score = clamp(Math.round(82 + summary.total * 1.4), 52, 96);
  const meals = items.slice(0, 4);
  const leadItem = meals[0];

  return (
    <main className="structure-page" aria-label="Vilo home structure reference">
      <section className="structure-phone">
        <header className="structure-appbar">
          <div className="structure-streak" aria-label="Current streak">
            <span className="structure-brand-dot">
              <Sparkles size={19} strokeWidth={2.4} />
            </span>
            <Flame size={22} strokeWidth={2.1} />
            <strong>0</strong>
          </div>

          <div className="structure-title">
            <CalendarDays size={21} strokeWidth={2.3} />
            <strong>Today</strong>
          </div>

          <button type="button" className="structure-icon-button" aria-label="More">
            <MoreHorizontal size={25} strokeWidth={2.7} />
          </button>
        </header>

        <WeekStrip />

        <section className="structure-nudge" aria-label="First meal reminder">
          <div>
            <h2>Scan your next meal to build today</h2>
            <button type="button">Scan now</button>
          </div>
          {leadItem && (
            <div className="structure-nudge-sticker">
              <img src={leadItem.image} alt="" />
            </div>
          )}
        </section>

        <section className="structure-score-card" aria-label={`${goal.label} score`}>
          <header>
            <span>{goal.label} plan</span>
            <strong>vilo</strong>
          </header>

          <div className="structure-score-main">
            <div>
              <strong>{score}</strong>
              <span>{goal.status}</span>
            </div>
            <ScoreArc score={score} />
          </div>

          <div className="structure-macro-grid">
            <MetricCell label="Protein" value="84 g left" progress="62%" />
            <MetricCell label="Fiber" value="14 g left" progress="48%" />
            <MetricCell label="Hydration" value="1.6 L" progress="70%" />
          </div>

          <button type="button" className="structure-secondary-action">
            End day
          </button>
        </section>

        <div className="structure-pager" aria-hidden="true">
          <span className="is-active" />
          <span />
        </div>

        <section className="structure-meal-card" aria-label="Breakfast">
          <header>
            <div>
              <h2>Breakfast</h2>
              <p>
                <Flame size={14} fill="currentColor" /> 285 kcal · 13 P · 31 C · 13 F
              </p>
            </div>
            <strong>vilo</strong>
          </header>

          <div className="structure-meal-list">
            {meals.slice(0, 3).map((item) => (
              <MealRow key={item.id} item={item} goalId={goal.metricGoalId} />
            ))}
          </div>

          <button type="button" className="structure-add-row">
            +
          </button>
        </section>
      </section>

      <nav className="structure-bottom-nav" aria-label="Reference navigation">
        <button type="button" className="is-active">
          <Layers size={23} />
          <span>Plan</span>
        </button>
        <button type="button">
          <UsersRound size={25} />
          <span>Social</span>
        </button>
        <button type="button">
          <BarChart3 size={25} />
          <span>Progress</span>
        </button>
        <button type="button">
          <MessageCircle size={24} />
          <span>Coach</span>
        </button>
      </nav>
    </main>
  );
}

function WeekStrip() {
  const days = [
    ["M", "4"],
    ["T", "5"],
    ["W", "6"],
    ["T", "7"],
    ["F", "8"],
    ["S", "9"],
    ["S", "10"],
  ];

  return (
    <section className="structure-week" aria-label="Week">
      {days.map(([label, date]) => (
        <button key={`${label}-${date}`} type="button" className={date === "5" ? "is-today" : ""}>
          <span>{label}</span>
          <strong>{date}</strong>
          <i />
        </button>
      ))}
    </section>
  );
}

function ScoreArc({ score }) {
  return (
    <svg className="structure-arc" viewBox="0 0 260 92" role="img" aria-label={`${score} score`}>
      <path d="M18 74 C78 50 182 50 242 74" pathLength="100" />
      <path className="is-fill" d="M18 74 C78 50 182 50 242 74" pathLength="100" style={{ "--score": score }} />
      <line x1="105" y1="50" x2="105" y2="65" />
      <line x1="158" y1="50" x2="158" y2="65" />
      <text x="105" y="90">steady</text>
      <text x="158" y="90">bright</text>
    </svg>
  );
}

function MetricCell({ label, value, progress }) {
  return (
    <div className="structure-metric">
      <strong>{label}</strong>
      <span>{value}</span>
      <i style={{ "--progress": progress }} />
    </div>
  );
}

function MealRow({ item, goalId }) {
  const impact = getGoalImpact(item, goalId);

  return (
    <article className="structure-meal-row">
      <img src={item.image} alt="" />
      <div>
        <strong>{item.name}</strong>
        <span>{item.localName} · {item.time}</span>
      </div>
      <b className={impact.isHelpful ? "is-good" : "is-watch"}>
        {formatSigned(impact.points)}
      </b>
      <UserRound size={19} strokeWidth={1.8} />
    </article>
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default HomeStructure;
