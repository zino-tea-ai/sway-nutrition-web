import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Flame,
  Leaf,
  Moon,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import {
  STICKER_BOARD_UPDATED_EVENT,
  defaultSelectedGoalIds,
  formatSigned,
  getGoalImpact,
  loadBoardItems,
  nextBoardMove,
  summarizeGoal,
} from "./stickerBoardData.js";
import "./sticker-board.css";

const goalCopy = {
  "weight-management": { label: "体重管理", short: "体重", metric: "负担" },
  "skin-state": { label: "皮肤状态", short: "皮肤", metric: "负担" },
  "afternoon-energy": { label: "下午能量", short: "能量", metric: "能量" },
  "blood-sugar-steadiness": { label: "血糖稳定", short: "稳定", metric: "稳定" },
  "gut-comfort": { label: "肠胃舒适", short: "肠胃", metric: "舒适" },
  "sleep-burden": { label: "睡眠负担", short: "睡眠", metric: "负担" },
  "workout-support": { label: "训练支持", short: "训练", metric: "支持" },
  "craving-control": { label: "控制嘴馋", short: "嘴馋", metric: "控制" },
};

const goalIcons = {
  "weight-management": Target,
  "skin-state": Sparkles,
  "afternoon-energy": Zap,
  "blood-sugar-steadiness": ShieldCheck,
  "gut-comfort": Leaf,
  "sleep-burden": Moon,
  "workout-support": Flame,
  "craving-control": Flame,
};

const reasonZh = {
  "filling without much extra load": "有饱腹感，额外负担不高",
  "fresh and not too processed": "够清爽，加工感不重",
  "protein and slower food": "有蛋白质，也不是只靠快糖",
  "paired with protein or fresh volume": "有蛋白质或清爽体积托住",
  "fresh volume makes it easier": "清爽体积让这一餐更好落地",
  "light enough to land cleanly": "整体够轻，不太压睡眠",
  "useful fuel with enough structure": "有可用能量，也有结构",
  "has something that lasts": "有一点能撑住的东西",
  "heavy or sweet load": "偏重或偏甜",
  "sweet, oily, or processed": "甜、油或加工感偏强",
  "quick food without enough support": "快能量多，支撑不够",
  "fast sweet food is doing most of the work": "主要靠甜和快碳水撑着",
  "spicy, oily, or processed": "辣、油或加工感偏强",
  "late, heavy, or stimulating": "偏晚、偏重或有刺激",
  "not enough useful fuel": "可用补给不够",
  "sweet or fast food is carrying it alone": "甜食或快碳水单独撑场",
  "spicy and oily": "又辣又油",
  "sweet and fast": "甜，而且来得快",
  "protein plus fresh volume": "蛋白质加清爽体积",
  "late and heavy": "偏晚，也偏重",
  "sweet and processed": "甜，加工感也明显",
  "stimulating drink": "有刺激性的饮品",
};

const foodCopy = {
  "Salmon rice bowl": {
    name: "三文鱼米饭碗",
    note: "午餐结构完整，有蛋白质，也有清爽体积。",
  },
  "Berry yogurt": {
    name: "莓果酸奶",
    note: "轻甜，但有乳制品打底。",
  },
  "Honey toast": {
    name: "蜂蜜吐司",
    note: "甜和快碳水比较明显，最好别单独撑一餐。",
  },
  "Avocado toast": {
    name: "牛油果吐司",
    note: "慢一点的加餐，有脂肪和清爽感。",
  },
  "Spicy fried noodles": {
    name: "香辣炒面",
    note: "偏晚、偏油、偏辣，肠胃和睡眠都要看一下。",
  },
  "Milk and berries": {
    name: "牛奶莓果",
    note: "轻加餐，有一点蛋白质和水果。",
  },
};

function StickerBoard() {
  const [items, setItems] = useState(() => loadBoardItems());
  const [selectedGoalIds, setSelectedGoalIds] = useState(defaultSelectedGoalIds);
  const [selectedItemId, setSelectedItemId] = useState(() => items[0]?.id || "");

  useEffect(() => {
    const refresh = () => setItems(loadBoardItems());
    window.addEventListener("storage", refresh);
    window.addEventListener(STICKER_BOARD_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STICKER_BOARD_UPDATED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0]?.id || "");
    }
  }, [items, selectedItemId]);

  const visibleItems = items.slice(0, 8);
  const selectedItem = items.find((item) => item.id === selectedItemId) || visibleItems[0];
  const goalSummaries = useMemo(
    () => selectedGoalIds.map((goalId) => summarizeGoal(items, goalId)),
    [items, selectedGoalIds],
  );
  const nextMove = useMemo(() => toChineseMove(nextBoardMove(items, selectedGoalIds)), [items, selectedGoalIds]);

  function toggleGoal(goalId) {
    setSelectedGoalIds((current) => {
      if (current.includes(goalId)) {
        return current.length === 1 ? current : current.filter((id) => id !== goalId);
      }
      return [...current.slice(-3), goalId];
    });
  }

  return (
    <main className="sticker-board-page">
      <section className="board-phone" aria-label="今天的贴纸板">
        <header className="board-header is-titlebar">
          <div>
            <span>5月03</span>
            <strong>今天的贴纸</strong>
          </div>
        </header>

        <section className="board-goals" aria-label="目标">
          {defaultSelectedGoalIds.map((goalId) => (
            <GoalChip
              key={goalId}
              goalId={goalId}
              active={selectedGoalIds.includes(goalId)}
              onClick={() => toggleGoal(goalId)}
            />
          ))}
        </section>

        <section className="sticker-stage" aria-label="今日食物贴纸">
          <div className="stage-note">
            <span>{visibleItems.length} 张</span>
            <strong>{bestGoalLine(goalSummaries)}</strong>
          </div>

          {visibleItems.map((item, index) => (
            <StickerPin
              key={item.id}
              item={item}
              index={index}
              selected={selectedItem?.id === item.id}
              selectedGoalIds={selectedGoalIds}
              onClick={() => setSelectedItemId(item.id)}
            />
          ))}
        </section>

        <section className="board-bottom-sheet" aria-label="今日变化">
          {selectedItem && (
            <div className="selected-food">
              <img src={selectedItem.image} alt="" />
              <div>
                <span>{selectedItem.time || "今天"}</span>
                <h1>{displayFoodName(selectedItem)}</h1>
                <p>{displayFoodNote(selectedItem)}</p>
              </div>
            </div>
          )}

          <div className="impact-strip">
            {selectedItem &&
              selectedGoalIds.map((goalId) => (
                <MiniImpact key={goalId} item={selectedItem} goalId={goalId} />
              ))}
          </div>

          <div className="next-card">
            <span>下一餐</span>
            <strong>{nextMove.title}</strong>
            <p>{nextMove.body}</p>
            <a href="/sticker-lab">
              再拍一个
              <ChevronRight size={16} />
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

function GoalChip({ active, goalId, onClick }) {
  const copy = goalCopy[goalId];
  const Icon = goalIcons[goalId] || Target;
  return (
    <button type="button" className={active ? "is-active" : ""} onClick={onClick} aria-pressed={active}>
      <Icon size={15} />
      <span>{copy.label}</span>
    </button>
  );
}

function StickerPin({ item, index, onClick, selected, selectedGoalIds }) {
  const leadImpact = selectedGoalIds
    .map((goalId) => getGoalImpact(item, goalId))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
  const copy = goalCopy[leadImpact?.goal.id] || goalCopy["afternoon-energy"];

  return (
    <button
      type="button"
      className={`sticker-pin ${selected ? "is-selected" : ""}`}
      style={positionStyle(item, index)}
      onClick={onClick}
      aria-label={displayFoodName(item)}
    >
      <img src={item.image} alt="" />
      <span>{displayFoodName(item)}</span>
      {leadImpact && (
        <b className={leadImpact.isHelpful ? "is-helpful" : "is-watch"}>
          {copy.short} {formatSigned(leadImpact.points)}
        </b>
      )}
    </button>
  );
}

function MiniImpact({ goalId, item }) {
  const impact = getGoalImpact(item, goalId);
  const copy = goalCopy[goalId];

  return (
    <article className={impact.isHelpful ? "is-helpful" : "is-watch"}>
      <span>{copy.label}</span>
      <strong>{copy.metric} {formatSigned(impact.points)}</strong>
      <p>{translateReason(impact.reason)}</p>
    </article>
  );
}

function bestGoalLine(summaries) {
  const watch = summaries
    .map((summary) => ({
      summary,
      pressure: summary.goal.better === "higher" ? -summary.total : summary.total,
    }))
    .sort((a, b) => b.pressure - a.pressure)[0]?.summary;
  if (!watch) return "看下一餐怎么补";
  const copy = goalCopy[watch.goal.id];
  return `${copy.label}${watch.isHelpful ? "还稳" : "需要注意"}`;
}

function toChineseMove(move) {
  if (move.title === "Make dinner easier to land") {
    return {
      title: "晚餐减一点负担",
      body: "保留想吃的主食物，把油、辣或酱少一点，再加一份清爽的东西。",
    };
  }

  if (move.title === "Go easier on oil and spice") {
    return {
      title: "下一餐清爽一点",
      body: "先用一份不油不辣的配菜把肠胃拉回来。",
    };
  }

  if (move.title === "Pair the fast food") {
    return {
      title: "给快碳水找个搭档",
      body: "甜食或面包可以留，但旁边加牛奶、酸奶、蛋、鱼或坚果。",
    };
  }

  if (move.title === "Add a food that lasts") {
    return {
      title: "加一个撑得住的食物",
      body: "先放一个清楚的蛋白质，再围绕它加水果或碳水。",
    };
  }

  if (move.title === "Lower the extra load") {
    return {
      title: "把额外负担降一档",
      body: "不用换掉这一餐，只把偏甜、偏油或偏重的部分少一点。",
    };
  }

  return {
    title: "重复今天最稳的结构",
    body: "一份主食物，一点蛋白质，再加清爽体积，别让甜食单独撑一餐。",
  };
}

function translateReason(reason) {
  return reasonZh[reason] || reason;
}

function positionStyle(item, index) {
  const position = item.position || {};
  const x = clamp(position.x ?? 18 + (index % 3) * 26, 18, 82);
  const y = clamp(position.y ?? 20 + Math.floor(index / 3) * 24, 16, 82);
  return {
    "--x": `${x}%`,
    "--y": `${y}%`,
    "--r": `${position.rotate ?? 0}deg`,
    "--s": position.size ?? 1,
  };
}

function displayFoodName(item) {
  const mapped = foodCopy[item.name]?.name;
  if (mapped) return mapped;
  if (/[\u4e00-\u9fff]/.test(item.localName || "")) return item.localName;
  return item.name;
}

function displayFoodNote(item) {
  return foodCopy[item.name]?.note || item.note;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default StickerBoard;
