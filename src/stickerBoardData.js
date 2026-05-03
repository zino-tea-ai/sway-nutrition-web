import avocado from "./assets/stickers/avocado.png";
import bowl from "./assets/stickers/bowl_with_spoon.png";
import bread from "./assets/stickers/bread.png";
import fire from "./assets/stickers/fire.png";
import milk from "./assets/stickers/glass_of_milk.png";
import strawberry from "./assets/stickers/strawberry.png";

export const STICKER_BOARD_STORAGE_KEY = "vilo.todayStickerBoard.v1";
export const STICKER_BOARD_UPDATED_EVENT = "vilo:sticker-board-updated";

export const boardGoals = [
  {
    id: "weight-management",
    label: "Weight management",
    short: "Weight",
    metric: "Weight load",
    better: "lower",
    target: "Keep today filling without stacking heavy extras.",
  },
  {
    id: "skin-state",
    label: "Skin state",
    short: "Skin",
    metric: "Skin burden",
    better: "lower",
    target: "Watch sweet, oily, and highly processed stickers.",
  },
  {
    id: "afternoon-energy",
    label: "Afternoon energy",
    short: "Energy",
    metric: "Energy",
    better: "higher",
    target: "Make the next sticker last longer than a quick snack.",
  },
  {
    id: "blood-sugar-steadiness",
    label: "Blood sugar steadiness",
    short: "Steady",
    metric: "Steadiness",
    better: "higher",
    target: "Pair fast carbs with protein or fresh volume.",
  },
  {
    id: "gut-comfort",
    label: "Gut comfort",
    short: "Gut",
    metric: "Gut comfort",
    better: "higher",
    target: "Keep oil, spice, and late heaviness visible.",
  },
  {
    id: "sleep-burden",
    label: "Sleep burden",
    short: "Sleep",
    metric: "Sleep burden",
    better: "lower",
    target: "Let dinner land lighter, especially late.",
  },
  {
    id: "workout-support",
    label: "Workout support",
    short: "Workout",
    metric: "Workout support",
    better: "higher",
    target: "Get useful fuel and a clear protein base.",
  },
  {
    id: "craving-control",
    label: "Craving control",
    short: "Cravings",
    metric: "Craving control",
    better: "higher",
    target: "Stop sweet or fast food from carrying the snack alone.",
  },
];

export const defaultSelectedGoalIds = [
  "weight-management",
  "afternoon-energy",
  "gut-comfort",
  "sleep-burden",
];

const boardPositions = [
  { x: 14, y: 18, rotate: -9, size: 1.08 },
  { x: 50, y: 11, rotate: 7, size: 1.0 },
  { x: 72, y: 31, rotate: -3, size: 0.95 },
  { x: 27, y: 50, rotate: 8, size: 0.96 },
  { x: 58, y: 58, rotate: -7, size: 1.05 },
  { x: 8, y: 72, rotate: 4, size: 0.9 },
  { x: 78, y: 72, rotate: 7, size: 0.9 },
  { x: 39, y: 28, rotate: -4, size: 0.86 },
];

export const seedBoardItems = [
  {
    id: "seed-salmon-bowl",
    name: "Salmon rice bowl",
    localName: "Lunch",
    time: "12:42",
    image: bowl,
    kcal: 520,
    attributes: {
      protein: 3,
      fresh: 2,
      slowCarb: 1,
      quickCarb: 0,
      sweet: 0,
      oil: 1,
      processed: 0,
      salt: 1,
      spice: 0,
      caffeine: 0,
      portion: 2,
      late: 0,
    },
    note: "Complete lunch with visible protein and fresh volume.",
    position: boardPositions[0],
  },
  {
    id: "seed-berry-yogurt",
    name: "Berry yogurt",
    localName: "Breakfast",
    time: "08:18",
    image: strawberry,
    kcal: 310,
    attributes: {
      protein: 2,
      fresh: 2,
      slowCarb: 1,
      quickCarb: 0,
      sweet: 1,
      oil: 0,
      processed: 0,
      salt: 0,
      spice: 0,
      caffeine: 0,
      portion: 1,
      late: 0,
    },
    note: "Light sweet start with a dairy base.",
    position: boardPositions[1],
  },
  {
    id: "seed-honey-toast",
    name: "Honey toast",
    localName: "Snack",
    time: "16:12",
    image: bread,
    kcal: 190,
    attributes: {
      protein: 0,
      fresh: 0,
      slowCarb: 0,
      quickCarb: 2,
      sweet: 2,
      oil: 0,
      processed: 1,
      salt: 0,
      spice: 0,
      caffeine: 0,
      portion: 1,
      late: 0,
    },
    note: "Fast sweet snack without much food structure.",
    position: boardPositions[2],
  },
  {
    id: "seed-avocado-toast",
    name: "Avocado toast",
    localName: "Dinner",
    time: "19:05",
    image: avocado,
    kcal: 340,
    attributes: {
      protein: 1,
      fresh: 2,
      slowCarb: 1,
      quickCarb: 0,
      sweet: 0,
      oil: 1,
      processed: 0,
      salt: 0,
      spice: 0,
      caffeine: 0,
      portion: 1,
      late: 1,
    },
    note: "Slower snack-style dinner with fresh volume.",
    position: boardPositions[3],
  },
  {
    id: "seed-spicy-noodles",
    name: "Spicy fried noodles",
    localName: "Late dinner",
    time: "21:20",
    image: fire,
    kcal: 680,
    attributes: {
      protein: 1,
      fresh: 0,
      slowCarb: 0,
      quickCarb: 2,
      sweet: 0,
      oil: 3,
      processed: 2,
      salt: 2,
      spice: 3,
      caffeine: 0,
      portion: 3,
      late: 2,
    },
    note: "Late, oily, spicy, and heavy enough to affect comfort.",
    position: boardPositions[4],
  },
  {
    id: "seed-milk-berries",
    name: "Milk and berries",
    localName: "Light snack",
    time: "10:34",
    image: milk,
    kcal: 210,
    attributes: {
      protein: 1,
      fresh: 2,
      slowCarb: 1,
      quickCarb: 0,
      sweet: 1,
      oil: 0,
      processed: 0,
      salt: 0,
      spice: 0,
      caffeine: 0,
      portion: 1,
      late: 0,
    },
    note: "Small protein base with fruit.",
    position: boardPositions[5],
  },
];

const goalById = new Map(boardGoals.map((goal) => [goal.id, goal]));

export function getBoardGoal(goalId) {
  return goalById.get(goalId) || boardGoals[0];
}

export function loadBoardItems() {
  const saved = readSavedBoardItems();
  const merged = [...saved, ...seedBoardItems.filter((item) => !saved.some((savedItem) => savedItem.id === item.id))];
  return merged.map((item, index) => normalizeBoardItem(item, index)).slice(0, 12);
}

export function appendBoardSticker(sticker) {
  if (typeof window === "undefined" || !sticker?.image) return false;

  const current = readSavedBoardItems();
  const nextItem = normalizeBoardItem(sticker, current.length);
  const nextItems = [nextItem, ...current.filter((item) => item.id !== nextItem.id)].slice(0, 8);

  try {
    window.localStorage.setItem(STICKER_BOARD_STORAGE_KEY, JSON.stringify(nextItems));
    window.dispatchEvent(new CustomEvent(STICKER_BOARD_UPDATED_EVENT, { detail: nextItems }));
    return true;
  } catch {
    return false;
  }
}

export function createBoardStickerFromAnalysis({ id, image, analysis, capturedAt = new Date() }) {
  const date = capturedAt instanceof Date ? capturedAt : new Date(capturedAt);
  return {
    id,
    name: analysis?.name || "Food sticker",
    localName: analysis?.localName || analysis?.type || "Captured food",
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    image,
    kcal: asNumber(analysis?.calories, 0),
    attributes: inferAttributes(analysis),
    note: analysis?.note || "Captured sticker added to today.",
    source: "capture",
  };
}

export async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not read sticker image.");
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export function getGoalImpact(item, goalId) {
  const goal = getBoardGoal(goalId);
  const attrs = normalizeAttributes(item.attributes);
  let points = 0;
  let reason = "";

  switch (goal.id) {
    case "weight-management":
      points = attrs.protein * -0.8 + attrs.fresh * -0.7 + attrs.sweet * 1.1 + attrs.oil * 0.8 + attrs.processed * 0.4 + Math.max(0, attrs.portion - 1) * 1.1;
      reason = points <= 0 ? "filling without much extra load" : plainReason(attrs, "heavy or sweet load");
      break;
    case "skin-state":
      points = attrs.sweet * 1.1 + attrs.oil * 0.7 + attrs.processed * 0.8 + attrs.salt * 0.35 - attrs.fresh * 0.45;
      reason = points <= 0 ? "fresh and not too processed" : plainReason(attrs, "sweet, oily, or processed");
      break;
    case "afternoon-energy":
      points = attrs.protein * 1.1 + attrs.fresh * 0.55 + attrs.slowCarb * 0.8 - attrs.sweet * 1 - attrs.quickCarb * 1 - attrs.caffeine * 0.2;
      reason = points >= 0 ? plainReason(attrs, "protein and slower food") : "quick food without enough support";
      break;
    case "blood-sugar-steadiness":
      points = attrs.protein * 0.9 + attrs.fresh * 0.8 + attrs.slowCarb * 0.75 - attrs.sweet * 1.35 - attrs.quickCarb * 1.25;
      reason = points >= 0 ? "paired with protein or fresh volume" : "fast sweet food is doing most of the work";
      break;
    case "gut-comfort":
      points = attrs.fresh * 1 + attrs.slowCarb * 0.35 - attrs.oil * 0.9 - attrs.spice * 1.05 - attrs.processed * 0.5 - attrs.late * 0.25;
      reason = points >= 0 ? "fresh volume makes it easier" : plainReason(attrs, "spicy, oily, or processed");
      break;
    case "sleep-burden":
      points = attrs.late * 1.25 + Math.max(0, attrs.portion - 1) * 0.9 + attrs.oil * 0.75 + attrs.spice * 0.55 + attrs.caffeine * 1.4 - attrs.fresh * 0.35;
      reason = points <= 0 ? "light enough to land cleanly" : plainReason(attrs, "late, heavy, or stimulating");
      break;
    case "workout-support":
      points = attrs.protein * 1.2 + attrs.slowCarb * 0.7 + attrs.portion * 0.25 - attrs.oil * 0.35 - attrs.sweet * 0.25;
      reason = points >= 0 ? "useful fuel with enough structure" : "not enough useful fuel";
      break;
    case "craving-control":
      points = attrs.protein * 1 + attrs.fresh * 0.75 + attrs.slowCarb * 0.45 - attrs.sweet * 1.2 - attrs.quickCarb * 1.05;
      reason = points >= 0 ? "has something that lasts" : "sweet or fast food is carrying it alone";
      break;
    default:
      points = 0;
      reason = item.note || "no clear movement";
  }

  const rounded = clamp(Math.round(points), -5, 5);
  return {
    goal,
    points: rounded,
    reason,
    isHelpful: goal.better === "higher" ? rounded >= 0 : rounded <= 0,
  };
}

export function summarizeGoal(items, goalId) {
  const goal = getBoardGoal(goalId);
  const impacts = items.map((item) => ({ item, impact: getGoalImpact(item, goalId) }));
  const total = clamp(
    impacts.reduce((sum, { impact }) => sum + impact.points, 0),
    -12,
    12,
  );
  const sorted = [...impacts].sort((a, b) => Math.abs(b.impact.points) - Math.abs(a.impact.points));
  const lead = sorted[0];
  return {
    goal,
    total,
    isHelpful: goal.better === "higher" ? total >= 0 : total <= 0,
    leadItem: lead?.item,
    reason: lead?.impact.reason || goal.target,
  };
}

export function nextBoardMove(items, selectedGoalIds) {
  const summaries = selectedGoalIds.map((goalId) => summarizeGoal(items, goalId));
  const priority = summaries
    .map((summary) => ({
      ...summary,
      pressure: summary.goal.better === "higher" ? -summary.total : summary.total,
    }))
    .sort((a, b) => b.pressure - a.pressure)[0];

  if (!priority || priority.pressure <= 1) {
    return {
      label: "Next meal",
      title: "Repeat the best structure",
      body: "Keep a clear main food, add something fresh, and avoid letting a sweet snack stand alone.",
    };
  }

  if (priority.goal.id === "sleep-burden") {
    return {
      label: "Next meal",
      title: "Make dinner easier to land",
      body: "Keep the satisfying part, but shrink the oily or spicy side and add cucumber, tomato, or herbs.",
    };
  }

  if (priority.goal.id === "gut-comfort") {
    return {
      label: "Next meal",
      title: "Go easier on oil and spice",
      body: "Choose one fresh side and keep the next sticker simpler so comfort can recover.",
    };
  }

  if (priority.goal.id === "blood-sugar-steadiness" || priority.goal.id === "craving-control") {
    return {
      label: "Next meal",
      title: "Pair the fast food",
      body: "Keep the bread or sweet item if you want it, but add milk, yogurt, eggs, fish, or nuts.",
    };
  }

  if (priority.goal.id === "afternoon-energy" || priority.goal.id === "workout-support") {
    return {
      label: "Next meal",
      title: "Add a food that lasts",
      body: "Use a visible protein base first, then add carbs or fruit around it.",
    };
  }

  return {
    label: "Next meal",
    title: "Lower the extra load",
    body: "Keep the meal familiar, but reduce the sweet, oily, or heavy part by one step.",
  };
}

export function formatSigned(points) {
  return points > 0 ? `+${points}` : `${points}`;
}

function readSavedBoardItems() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STICKER_BOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.id && item?.image);
  } catch {
    return [];
  }
}

function normalizeBoardItem(item, index) {
  return {
    ...item,
    name: item.name || "Food sticker",
    localName: item.localName || "Today",
    time: item.time || "",
    kcal: asNumber(item.kcal, 0),
    attributes: normalizeAttributes(item.attributes),
    position: item.position || boardPositions[index % boardPositions.length],
  };
}

function inferAttributes(analysis) {
  const name = `${analysis?.name || ""} ${analysis?.localName || ""} ${analysis?.type || ""} ${analysis?.note || ""}`.toLowerCase();
  const calories = asNumber(analysis?.calories, 0);
  const protein = asNumber(analysis?.protein, 0);
  const fiber = asNumber(analysis?.fiber, 0);
  const unsweetened = /unsweetened|no sugar|zero sugar|无糖/.test(name);
  const sweet = !unsweetened && /sweet|sugar|honey|dessert|cake|cookie|chocolate|奶茶|甜|糖/.test(name);
  const fresh = /salad|fruit|berry|berries|vegetable|tomato|cucumber|avocado|fresh|水果|蔬菜|黄瓜|番茄|牛油果/.test(name);
  const fried = /fried|fries|油炸|炸|煎/.test(name);
  const spicy = /spicy|pepper|chili|辣/.test(name);
  const drink = /drink|tea|coffee|bottle|beverage|茶|咖啡|饮料/.test(name);

  return normalizeAttributes({
    protein: protein >= 28 ? 3 : protein >= 12 ? 2 : protein > 0 ? 1 : 0,
    fresh: Math.max(fiber >= 6 ? 2 : fiber >= 3 ? 1 : 0, fresh ? 2 : 0),
    slowCarb: fiber >= 4 ? 1 : 0,
    quickCarb: /toast|bread|rice|noodle|pasta|bun|吐司|面|饭|粉/.test(name) ? 1 : 0,
    sweet: sweet ? 2 : 0,
    oil: fried ? 2 : /oil|cream|cheese|butter|sauce|油|奶油|芝士|黄油/.test(name) ? 1 : 0,
    processed: drink || /processed|packaged|instant|bottle|snack|加工|包装|方便/.test(name) ? 1 : 0,
    salt: /salt|sodium|sauce|soy|咸|酱/.test(name) ? 1 : 0,
    spice: spicy ? 2 : 0,
    caffeine: /tea|coffee|matcha|caffeine|茶|咖啡|抹茶/.test(name) ? 1 : 0,
    portion: calories >= 650 ? 3 : calories >= 380 ? 2 : calories > 80 ? 1 : 0,
    late: 0,
  });
}

function normalizeAttributes(attrs = {}) {
  return {
    protein: asNumber(attrs.protein, 0),
    fresh: asNumber(attrs.fresh, 0),
    slowCarb: asNumber(attrs.slowCarb, 0),
    quickCarb: asNumber(attrs.quickCarb, 0),
    sweet: asNumber(attrs.sweet, 0),
    oil: asNumber(attrs.oil, 0),
    processed: asNumber(attrs.processed, 0),
    salt: asNumber(attrs.salt, 0),
    spice: asNumber(attrs.spice, 0),
    caffeine: asNumber(attrs.caffeine, 0),
    portion: asNumber(attrs.portion, 0),
    late: asNumber(attrs.late, 0),
  };
}

function plainReason(attrs, fallback) {
  if (attrs.spice >= 2 && attrs.oil >= 2) return "spicy and oily";
  if (attrs.sweet >= 2 && attrs.quickCarb >= 1) return "sweet and fast";
  if (attrs.protein >= 2 && attrs.fresh >= 1) return "protein plus fresh volume";
  if (attrs.late >= 1 && attrs.portion >= 2) return "late and heavy";
  if (attrs.processed >= 1 && attrs.sweet >= 1) return "sweet and processed";
  if (attrs.caffeine >= 1) return "stimulating drink";
  return fallback;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function asNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
