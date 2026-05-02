import {
  BarChart3,
  Barcode,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Compass,
  Dumbbell,
  Flame,
  Gauge,
  Keyboard,
  Leaf,
  Mic2,
  Moon,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import avocado from "./assets/stickers/avocado.png";
import bowl from "./assets/stickers/bowl_with_spoon.png";
import bread from "./assets/stickers/bread.png";
import cheese from "./assets/stickers/cheese_wedge.png";
import cucumber from "./assets/stickers/cucumber.png";
import meat from "./assets/stickers/cut_of_meat.png";
import herb from "./assets/stickers/herb.png";
import honey from "./assets/stickers/honey_pot.png";
import milk from "./assets/stickers/glass_of_milk.png";
import strawberry from "./assets/stickers/strawberry.png";
import tomato from "./assets/stickers/tomato.png";

const goals = [
  {
    id: "steady-energy",
    label: "Steady energy",
    labelZh: "稳定能量",
    short: "Energy",
    shortZh: "能量",
    icon: Zap,
    scoreLabel: "Steady Energy Fit",
    scoreLabelZh: "稳定能量适配度",
    promise: "Fewer spikes, fewer dips, meals that last.",
    promiseZh: "少一点猛升猛降，让一餐更撑得住。",
    weights: {
      protein: 1.05,
      fiber: 1.15,
      fresh: 0.75,
      complete: 1,
      sweet: 1.25,
      quickCarb: 1.1,
      heavyDinner: 0.45,
      lightProtein: 0.95,
    },
  },
  {
    id: "calm-afternoon",
    label: "Calm afternoon",
    labelZh: "平稳下午",
    short: "Calm",
    shortZh: "平稳",
    icon: ShieldCheck,
    scoreLabel: "Afternoon Calm Fit",
    scoreLabelZh: "下午平稳适配度",
    promise: "Less snack panic and fewer sugar-only moments.",
    promiseZh: "减少突然想吃甜和只有糖撑场面的时刻。",
    weights: {
      protein: 0.85,
      fiber: 1.05,
      fresh: 1,
      complete: 0.8,
      sweet: 1.45,
      quickCarb: 1.2,
      heavyDinner: 0.25,
      lightProtein: 0.85,
    },
  },
  {
    id: "sleep-support",
    label: "Sleep support",
    labelZh: "支持睡眠",
    short: "Sleep",
    shortZh: "睡眠",
    icon: Moon,
    scoreLabel: "Sleep Support Fit",
    scoreLabelZh: "睡眠支持适配度",
    promise: "Dinner that feels complete without landing heavy.",
    promiseZh: "晚餐要完整，但不要落得太重。",
    weights: {
      protein: 0.75,
      fiber: 0.85,
      fresh: 1.05,
      complete: 0.8,
      sweet: 1.05,
      quickCarb: 0.8,
      heavyDinner: 1.6,
      lightProtein: 0.7,
    },
  },
  {
    id: "stronger-training",
    label: "Stronger training",
    labelZh: "训练补给",
    short: "Train",
    shortZh: "训练",
    icon: Dumbbell,
    scoreLabel: "Training Fuel Fit",
    scoreLabelZh: "训练补给适配度",
    promise: "Protein and useful fuel without a macro spreadsheet.",
    promiseZh: "有蛋白质和可用能量，但不变成宏量营养表。",
    weights: {
      protein: 1.45,
      fiber: 0.55,
      fresh: 0.55,
      complete: 1.15,
      sweet: 0.6,
      quickCarb: 0.35,
      heavyDinner: 0.2,
      lightProtein: 1.35,
    },
  },
];

const goalById = Object.fromEntries(goals.map((goal) => [goal.id, goal]));

const mealTemplates = [
  {
    id: "berry-yogurt",
    name: "Berry yogurt bowl",
    nameZh: "莓果酸奶碗",
    family: "Breakfast",
    familyZh: "早餐",
    image: strawberry,
    images: [strawberry, milk, honey],
    description: "Fruit, dairy protein, and a small sweet accent.",
    descriptionZh: "水果、乳制品蛋白质，再加一点甜味点缀。",
    facts: { kcal: 310, protein: 18, fiber: 5, carbs: 39, sugar: 19 },
    traits: { fresh: 2, sweet: 1, quickCarb: 0, complete: true },
    defaultMeal: "Breakfast",
  },
  {
    id: "salmon-bowl",
    name: "Salmon bowl",
    nameZh: "三文鱼碗",
    family: "Complete meal",
    familyZh: "完整一餐",
    image: bowl,
    images: [bowl, cucumber, herb],
    description: "Protein anchor, rice, greens, and enough fat to feel steady.",
    descriptionZh: "蛋白质锚点、米饭、绿色配菜和一点脂肪，整体更稳。",
    facts: { kcal: 520, protein: 34, fiber: 6, carbs: 48, sugar: 5 },
    traits: { fresh: 2, sweet: 0, quickCarb: 0, complete: true },
    defaultMeal: "Lunch",
  },
  {
    id: "bread-honey",
    name: "Toast with honey",
    nameZh: "蜂蜜吐司",
    family: "Snack",
    familyZh: "加餐",
    image: bread,
    images: [bread, honey],
    description: "Fast, comforting energy. Best when it is not eaten alone.",
    descriptionZh: "快、舒服的能量。最好不要单独吃。",
    facts: { kcal: 190, protein: 4, fiber: 2, carbs: 38, sugar: 17 },
    traits: { fresh: 0, sweet: 1, quickCarb: 1, complete: false },
    defaultMeal: "Snack",
  },
  {
    id: "avocado-toast",
    name: "Avocado toast",
    nameZh: "牛油果吐司",
    family: "Snack",
    familyZh: "加餐",
    image: avocado,
    images: [avocado, bread, tomato],
    description: "A slower snack with fat, fiber, and some fresh acidity.",
    descriptionZh: "更慢一点的加餐，有脂肪、纤维和一点清爽酸度。",
    facts: { kcal: 340, protein: 8, fiber: 10, carbs: 34, sugar: 4 },
    traits: { fresh: 1, sweet: 0, quickCarb: 0, complete: false },
    defaultMeal: "Snack",
  },
  {
    id: "steak-plate",
    name: "Steak plate",
    nameZh: "牛排餐盘",
    family: "Dinner",
    familyZh: "晚餐",
    image: meat,
    images: [meat, tomato, cucumber],
    description: "Dense protein with a fresh side. Strong, but late portions matter.",
    descriptionZh: "高密度蛋白质配清爽边菜。很有力，但晚餐份量要看。",
    facts: { kcal: 610, protein: 47, fiber: 4, carbs: 30, sugar: 6 },
    traits: { fresh: 2, sweet: 0, quickCarb: 0, complete: true },
    defaultMeal: "Dinner",
  },
  {
    id: "milk-strawberry",
    name: "Milk and strawberries",
    nameZh: "牛奶草莓",
    family: "Light snack",
    familyZh: "轻加餐",
    image: milk,
    images: [milk, strawberry],
    description: "A light sweet snack with a small protein base.",
    descriptionZh: "轻甜加餐，有一点蛋白质打底。",
    facts: { kcal: 210, protein: 10, fiber: 3, carbs: 28, sugar: 21 },
    traits: { fresh: 1, sweet: 1, quickCarb: 0, complete: false },
    defaultMeal: "Snack",
  },
  {
    id: "cheese-toast",
    name: "Cheese toast",
    nameZh: "芝士吐司",
    family: "Snack",
    familyZh: "加餐",
    image: cheese,
    images: [cheese, bread],
    description: "Carb plus protein. More stable than plain toast.",
    descriptionZh: "碳水加蛋白质，比单吃吐司更稳。",
    facts: { kcal: 280, protein: 14, fiber: 2, carbs: 28, sugar: 3 },
    traits: { fresh: 0, sweet: 0, quickCarb: 0, complete: false },
    defaultMeal: "Snack",
  },
  {
    id: "fresh-side",
    name: "Cucumber herb side",
    nameZh: "黄瓜香草配菜",
    family: "Add-on",
    familyZh: "加一份",
    image: cucumber,
    images: [cucumber, herb],
    description: "Low-load freshness that makes a plate feel easier.",
    descriptionZh: "负担很低的清爽体积，让一餐更容易落地。",
    facts: { kcal: 35, protein: 2, fiber: 2, carbs: 7, sugar: 3 },
    traits: { fresh: 2, sweet: 0, quickCarb: 0, complete: false },
    defaultMeal: "Dinner",
  },
];

const templateById = Object.fromEntries(mealTemplates.map((meal) => [meal.id, meal]));

const initialEntries = [
  {
    id: "entry-1",
    templateId: "berry-yogurt",
    mealType: "Breakfast",
    portion: "normal",
    time: "08:18",
  },
  {
    id: "entry-2",
    templateId: "salmon-bowl",
    mealType: "Lunch",
    portion: "normal",
    time: "12:42",
  },
  {
    id: "entry-3",
    templateId: "bread-honey",
    mealType: "Snack",
    portion: "normal",
    time: "16:12",
  },
  {
    id: "entry-4",
    templateId: "avocado-toast",
    mealType: "Dinner",
    portion: "light",
    time: "19:05",
  },
];

const navItems = [
  { id: "today", label: "Today", icon: Utensils },
  { id: "foods", label: "Foods", icon: Compass },
  { id: "patterns", label: "Patterns", icon: BarChart3 },
  { id: "you", label: "You", icon: CircleUserRound },
];

const mealTypes = ["Breakfast", "Lunch", "Snack", "Dinner"];
const portions = [
  { id: "light", label: "Light", labelZh: "偏轻", factor: 0.72 },
  { id: "normal", label: "Normal", labelZh: "正常", factor: 1 },
  { id: "heavy", label: "Heavy", labelZh: "偏重", factor: 1.28 },
];

const weeklyPattern = [
  { day: "Mon", score: 68, mover: "Protein too light", meals: ["bread-honey", "milk-strawberry"] },
  { day: "Tue", score: 74, mover: "Fiber helped", meals: ["berry-yogurt", "avocado-toast"] },
  { day: "Wed", score: 84, mover: "Complete lunch", meals: ["salmon-bowl", "fresh-side"] },
  { day: "Thu", score: 71, mover: "Quick carb alone", meals: ["bread-honey", "cheese-toast"] },
  { day: "Fri", score: 79, mover: "Protein anchor", meals: ["salmon-bowl", "steak-plate"] },
];

const UI = {
  en: {
    today: "Today",
    searchMeals: "Search meals",
    logMeal: "Log meal",
    goalScore: "Goal score",
    todayScore: "Today",
    scoreMovers: "Score movers",
    changedNumber: "What changed the number",
    nextMove: "Next move",
    logNextMeal: "Log next meal",
    mealLog: "Meal log",
    entryExplains: "Every entry explains itself",
    addMeal: "Add meal",
    todayPlan: "Today's plan",
    mealsToday: "Meals today",
    mealSlots: "Meal slots",
    mealSlotsBody: "Log by the moment you actually eat. Tap a meal to see the scorecard.",
    quickCapture: "Log in 10 seconds",
    quickCaptureBody: "Say it, snap it, type it, or scan it. The app turns one messy meal into a clear result.",
    voiceInput: "Voice",
    photoInput: "Photo",
    textInput: "Text",
    barcodeInput: "Barcode",
    liveResult: "Meal result",
    whyChanged: "Why the score moved",
    nextMeal: "Next meal",
    stickerJournal: "Sticker journal",
    goalLens: "Goal lens",
    tuneGoal: "Change goal",
    logged: "logged",
    emptySlot: "No food yet",
    addHere: "Add here",
    score: "Score",
    howReadsFood: "How it reads food",
    simpleMath: "Simple rules, visible math",
    foodLibrary: "Food library",
    mealsScored: "Meals are scored against your goal",
    logThis: "Log this",
    patterns: "Patterns",
    weeklySignals: "Weekly signals stay tied to the score",
    onboarding: "Onboarding",
    goalChoosesLens: "Your goal chooses the scoring lens",
    onboardingBody:
      "Sway does not ask users to understand nutrition first. The user chooses an outcome, logs a meal, and the app translates food into goal fit.",
    tryFlow: "Try the flow",
    mealScorecard: "Meal scorecard",
    raw: { kcal: "kcal", protein: "protein", fiber: "fiber" },
    inspectorNext: "Next move",
    logAnother: "Log another meal",
    modalTitle: "Pick food, preview score, save",
    meal: "Meal",
    context: "Context",
    preview: "Preview",
    cancel: "Cancel",
    addToToday: "Add to today",
    primaryGoal: "Primary goal",
    eatingRhythm: "Eating rhythm",
    rhythmValue: "Breakfast, lunch, snack, dinner",
    outputFormat: "Output format",
    outputValue: "Score, movers, raw facts, next move",
    dataDensity: "Data density",
    dataValue: "Simple number, visible math",
    ruleRows: [
      ["Protein anchor", "+20 max"],
      ["Fiber and fresh side", "+24 max"],
      ["Complete meal", "+8 base"],
      ["Sweet without anchor", "-12 base"],
      ["Heavy late dinner", "-11 base"],
    ],
    nav: { today: "Today", foods: "Foods", patterns: "Patterns", you: "You" },
    grades: { Great: "Great", Good: "Good", Okay: "Okay", "Needs support": "Needs support" },
  },
  zh: {
    today: "今天",
    searchMeals: "搜索餐食",
    logMeal: "记录一餐",
    goalScore: "目标分数",
    todayScore: "今天",
    scoreMovers: "分数影响项",
    changedNumber: "这个分数怎么来的",
    nextMove: "下一步",
    logNextMeal: "记录下一餐",
    mealLog: "饮食记录",
    entryExplains: "每条记录都说清楚原因",
    addMeal: "加一餐",
    todayPlan: "今天的计划",
    mealsToday: "今天的餐",
    mealSlots: "按餐次记录",
    mealSlotsBody: "按照真实吃饭的时刻记录。点一餐，就看到分数卡。",
    quickCapture: "10 秒记录一餐",
    quickCaptureBody: "可以说、拍、打字或扫码。产品把一餐混乱的信息翻译成清晰结果。",
    voiceInput: "语音",
    photoInput: "拍照",
    textInput: "文字",
    barcodeInput: "扫码",
    liveResult: "单餐结果",
    whyChanged: "分数为什么变了",
    nextMeal: "下一餐",
    stickerJournal: "贴纸日记",
    goalLens: "目标镜头",
    tuneGoal: "调整目标",
    logged: "已记录",
    emptySlot: "还没记录",
    addHere: "在这里加",
    score: "分数",
    howReadsFood: "它怎么看食物",
    simpleMath: "简单规则，可见计算",
    foodLibrary: "食物库",
    mealsScored: "每一餐都会按你的目标打分",
    logThis: "记录这个",
    patterns: "模式",
    weeklySignals: "一周信号仍然回到分数",
    onboarding: "引导",
    goalChoosesLens: "用户选择目标，系统选择评分镜头",
    onboardingBody:
      "Sway 不要求用户先懂营养。用户只需要选一个想要的结果，记录一餐，产品把食物翻译成目标适配度。",
    tryFlow: "试一遍流程",
    mealScorecard: "单餐分数卡",
    raw: { kcal: "千卡", protein: "蛋白质", fiber: "纤维" },
    inspectorNext: "下一步",
    logAnother: "再记录一餐",
    modalTitle: "选择食物，预览分数，再保存",
    meal: "餐食",
    context: "场景",
    preview: "预览",
    cancel: "取消",
    addToToday: "加入今天",
    primaryGoal: "主目标",
    eatingRhythm: "饮食节奏",
    rhythmValue: "早餐、午餐、加餐、晚餐",
    outputFormat: "输出格式",
    outputValue: "分数、加扣分、原始数据、下一步",
    dataDensity: "数据密度",
    dataValue: "一个简单数字，看得见计算",
    ruleRows: [
      ["蛋白质锚点", "+20 最高"],
      ["纤维和清爽配菜", "+24 最高"],
      ["结构完整", "+8 基础"],
      ["甜食没有锚点", "-12 基础"],
      ["晚餐偏重", "-11 基础"],
    ],
    nav: { today: "今天", foods: "食物", patterns: "模式", you: "你" },
    grades: { Great: "很好", Good: "不错", Okay: "还行", "Needs support": "需要补一下" },
  },
};

const moverZh = {
  "Protein anchor": "蛋白质锚点",
  "Some protein": "有一点蛋白质",
  "Protein too light": "蛋白质偏轻",
  "Fiber helped": "纤维有帮助",
  "Some fiber": "有一些纤维",
  "Fresh side": "清爽配菜",
  "Complete meal": "结构完整",
  "Sweet without anchor": "甜食没有锚点",
  "Sweet load": "甜度偏高",
  "Quick carb alone": "快碳水单独出现",
  "Heavy late meal": "晚餐偏重",
  "Sweet dinner": "晚餐偏甜",
};

const evidenceZh = {
  "fresh color on the plate": "盘子里有清爽颜色",
  "protein, carb, and side together": "蛋白质、碳水和配菜在一起",
  "fast carb without enough protein": "快碳水旁边缺少蛋白质",
  "sweet food late": "偏晚的甜食",
};

const mealTypeZh = {
  Breakfast: "早餐",
  Lunch: "午餐",
  Snack: "加餐",
  Dinner: "晚餐",
};

function t(locale) {
  return UI[locale] ?? UI.en;
}

function goalText(goal, locale) {
  if (locale !== "zh") return goal;
  return {
    ...goal,
    label: goal.labelZh,
    short: goal.shortZh,
    scoreLabel: goal.scoreLabelZh,
    promise: goal.promiseZh,
  };
}

function mealText(meal, locale) {
  if (locale !== "zh") return meal;
  return {
    ...meal,
    name: meal.nameZh,
    family: meal.familyZh,
    description: meal.descriptionZh,
  };
}

function portionText(portionId, locale) {
  const portion = portions.find((item) => item.id === portionId) ?? portions[1];
  return locale === "zh" ? portion.labelZh : portion.label.toLowerCase();
}

function mealTypeText(mealType, locale) {
  return locale === "zh" ? mealTypeZh[mealType] ?? mealType : mealType;
}

function moverLabel(label, locale) {
  return locale === "zh" ? moverZh[label] ?? label : label;
}

function evidenceText(evidence, locale) {
  if (locale !== "zh") return evidence;
  if (!evidence) return evidence;
  if (/^\d+ meals$/.test(evidence)) return evidence.replace("meals", "餐");
  if (/^\d+g protein$/.test(evidence)) return evidence.replace("protein", "蛋白质");
  if (/^\d+g fiber$/.test(evidence)) return evidence.replace("fiber", "纤维");
  if (/^\d+g sugar/.test(evidence)) return evidence.replace("sugar", "糖");
  if (/^\d+ kcal/.test(evidence)) return evidence.replace("at dinner", "，出现在晚餐");
  return evidenceZh[evidence] ?? evidence;
}

function nextActionText(action, locale, goal) {
  if (locale !== "zh") return action;
  const zh = {
    repeat: {
      title: "重复这个结构",
      body: `这对${goalText(goal, "zh").label}有效。下一餐继续保留“锚点、配菜、平衡”的结构。`,
    },
    sweetAnchor: {
      title: "甜食旁边加锚点",
      body: "甜的东西可以保留，但旁边要有牛奶、酸奶、芝士、鸡蛋、鱼或坚果，不要让甜食单独撑起一餐。",
    },
    lightDinner: {
      title: "让晚餐更容易落地",
      body: "保留蛋白质，减少淀粉或酱汁，再加黄瓜、番茄或香草，用体积替代负担。",
    },
    pairSnack: {
      title: "把加餐变成一组搭配",
      body: "面包或米饭本身没问题，关键是加一个蛋白质或清爽配菜，让能量更持久。",
    },
    proteinNext: {
      title: "下一餐加蛋白质锚点",
      body: "下一餐先放一个明确的蛋白质基础，再加快能量。",
    },
    smallCorrection: {
      title: "做一个小修正",
      body: "这餐可以留在常吃清单里，只需要调整拉低分数的那一部分。",
    },
  };
  return zh[action.key] ?? action;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gradeFor(score) {
  if (score >= 86) return "Great";
  if (score >= 72) return "Good";
  if (score >= 58) return "Okay";
  return "Needs support";
}

function portionFactor(portionId) {
  return portions.find((portion) => portion.id === portionId)?.factor ?? 1;
}

function scaleFacts(facts, portionId) {
  const factor = portionFactor(portionId);
  return Object.fromEntries(
    Object.entries(facts).map(([key, value]) => [key, Math.round(value * factor)]),
  );
}

function addMover(movers, label, points, type, evidence) {
  if (points === 0) return;
  movers.push({ label, points: Math.round(points), type, evidence });
}

function evaluateMeal(template, goalId, context = {}) {
  const goal = goalById[goalId] ?? goals[0];
  const mealType = context.mealType ?? template.defaultMeal;
  const portion = context.portion ?? "normal";
  const facts = scaleFacts(template.facts, portion);
  const weights = goal.weights;
  const movers = [];

  if (facts.protein >= 28) {
    addMover(movers, "Protein anchor", 20 * weights.protein, "positive", `${facts.protein}g protein`);
  } else if (facts.protein >= 12) {
    addMover(movers, "Some protein", 11 * weights.protein, "positive", `${facts.protein}g protein`);
  } else {
    addMover(movers, "Protein too light", -9 * weights.lightProtein, "negative", `${facts.protein}g protein`);
  }

  if (facts.fiber >= 7) {
    addMover(movers, "Fiber helped", 14 * weights.fiber, "positive", `${facts.fiber}g fiber`);
  } else if (facts.fiber >= 4) {
    addMover(movers, "Some fiber", 8 * weights.fiber, "positive", `${facts.fiber}g fiber`);
  }

  if (template.traits.fresh > 0) {
    addMover(movers, "Fresh side", (6 + template.traits.fresh * 3) * weights.fresh, "positive", "fresh color on the plate");
  }

  if (template.traits.complete) {
    addMover(movers, "Complete meal", 8 * weights.complete, "positive", "protein, carb, and side together");
  }

  if (template.traits.sweet && facts.protein < 12) {
    addMover(movers, "Sweet without anchor", -12 * weights.sweet, "negative", `${facts.sugar}g sugar, low protein`);
  } else if (template.traits.sweet && facts.sugar > 18) {
    addMover(movers, "Sweet load", -6 * weights.sweet, "negative", `${facts.sugar}g sugar`);
  }

  if (template.traits.quickCarb && facts.protein < 10) {
    addMover(movers, "Quick carb alone", -9 * weights.quickCarb, "negative", "fast carb without enough protein");
  }

  if (mealType === "Dinner" && (portion === "heavy" || facts.kcal >= 700)) {
    addMover(movers, "Heavy late meal", -11 * weights.heavyDinner, "negative", `${facts.kcal} kcal at dinner`);
  }

  if (mealType === "Dinner" && facts.sugar >= 18) {
    addMover(movers, "Sweet dinner", -7 * Math.max(weights.sweet, weights.heavyDinner * 0.7), "negative", "sweet food late");
  }

  const score = clamp(58 + movers.reduce((sum, mover) => sum + mover.points, 0), 22, 98);
  const negative = movers
    .filter((mover) => mover.points < 0)
    .sort((a, b) => a.points - b.points)[0];

  return {
    goal,
    template,
    mealType,
    portion,
    facts,
    score,
    grade: gradeFor(score),
    movers: movers.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    nextAction: nextActionFor(negative, template, goal),
  };
}

function nextActionFor(negative, template, goal) {
  if (!negative) {
    return {
      key: "repeat",
      title: "Repeat the structure",
      body: `This works for ${goal.label.toLowerCase()}. Keep the next meal built around the same anchor-side-balance pattern.`,
    };
  }

  if (negative.label === "Sweet without anchor" || negative.label === "Sweet dinner") {
    return {
      key: "sweetAnchor",
      title: "Pair sweet with an anchor",
      body: "Keep the sweet item, but add milk, yogurt, cheese, eggs, fish, or nuts so it does not carry the meal alone.",
    };
  }

  if (negative.label === "Heavy late meal") {
    return {
      key: "lightDinner",
      title: "Make dinner easier to land",
      body: "Keep the protein, shrink the starch or sauce, and add cucumber, tomato, or herbs for volume without heaviness.",
    };
  }

  if (negative.label === "Quick carb alone") {
    return {
      key: "pairSnack",
      title: "Turn the snack into a pair",
      body: "Bread or rice is fine; the fix is adding a protein or fresh side so the energy arc lasts longer.",
    };
  }

  if (negative.label === "Protein too light") {
    return {
      key: "proteinNext",
      title: "Add a protein anchor next",
      body: "The next meal should include a clear protein base before adding more fast fuel.",
    };
  }

  return {
    key: "smallCorrection",
    title: "Make one small correction",
    body: `Keep ${template.name.toLowerCase()} in the rotation, but adjust the part that lowered the fit score.`,
  };
}

function summarizeDay(entries, goalId) {
  const assessments = entries.map((entry) =>
    evaluateMeal(templateById[entry.templateId], goalId, entry),
  );
  const score = Math.round(
    assessments.reduce((sum, assessment) => sum + assessment.score, 0) / assessments.length,
  );
  const facts = assessments.reduce(
    (total, assessment) => ({
      kcal: total.kcal + assessment.facts.kcal,
      protein: total.protein + assessment.facts.protein,
      fiber: total.fiber + assessment.facts.fiber,
      carbs: total.carbs + assessment.facts.carbs,
      sugar: total.sugar + assessment.facts.sugar,
    }),
    { kcal: 0, protein: 0, fiber: 0, carbs: 0, sugar: 0 },
  );
  const moverMap = new Map();
  assessments.forEach((assessment) => {
    assessment.movers.forEach((mover) => {
      const current = moverMap.get(mover.label) ?? {
        ...mover,
        points: 0,
        count: 0,
      };
      current.points += mover.points;
      current.count += 1;
      moverMap.set(mover.label, current);
    });
  });

  const movers = [...moverMap.values()]
    .map((mover) => ({
      ...mover,
      evidence: mover.count > 1 ? `${mover.count} meals` : mover.evidence,
    }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const topNegative = movers.filter((mover) => mover.points < 0).sort((a, b) => a.points - b.points)[0];
  const reference = assessments[assessments.length - 1] ?? assessments[0];

  return {
    score,
    grade: gradeFor(score),
    facts,
    movers,
    assessments,
    nextAction: nextActionFor(topNegative, reference?.template ?? mealTemplates[0], goalById[goalId]),
  };
}

function formatSigned(points) {
  return points > 0 ? `+${points}` : `${points}`;
}

function currentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function App() {
  const [tab, setTab] = useState("today");
  const [activeGoal, setActiveGoal] = useState("steady-energy");
  const [entries, setEntries] = useState(initialEntries);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntries[1].id);
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [logTemplateId, setLogTemplateId] = useState("salmon-bowl");
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState(() => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");
    if (urlLocale === "en" || urlLocale === "zh") return urlLocale;
    return localStorage.getItem("sway-locale") || "en";
  });
  const copy = t(locale);
  const activeGoalInfo = goalById[activeGoal];
  const day = useMemo(() => summarizeDay(entries, activeGoal), [entries, activeGoal]);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];
  const selectedAssessment = selectedEntry
    ? evaluateMeal(templateById[selectedEntry.templateId], activeGoal, selectedEntry)
    : day.assessments[0];

  function openLogger(templateId = "salmon-bowl") {
    const safeTemplateId = typeof templateId === "string" ? templateId : "salmon-bowl";
    setLogTemplateId(safeTemplateId);
    setLoggerOpen(true);
  }

  function addMeal({ templateId, mealType, portion }) {
    const entry = {
      id: `entry-${Date.now()}`,
      templateId,
      mealType,
      portion,
      time: currentTime(),
    };
    setEntries((current) => [entry, ...current]);
    setSelectedEntryId(entry.id);
    setTab("today");
    setLoggerOpen(false);
  }

  useEffect(() => {
    localStorage.setItem("sway-locale", locale);
  }, [locale]);

  return (
    <div className={`app-shell lang-${locale}`}>
      <aside className="rail" aria-label="Primary navigation">
        <button className="brand-mark" type="button" onClick={() => setTab("today")} aria-label="Sway home">
          <Sparkles size={20} strokeWidth={1.8} />
        </button>
        <nav className="rail-nav">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              label={copy.nav[item.id]}
              active={tab === item.id}
              onClick={() => setTab(item.id)}
            />
          ))}
        </nav>
        <button className="scan-button" type="button" onClick={openLogger} aria-label={copy.logMeal}>
          <Plus size={24} />
        </button>
      </aside>

      <main className="workspace">
        <TopBar
          goal={activeGoalInfo}
          day={day}
          query={query}
          setQuery={setQuery}
          onLog={openLogger}
          locale={locale}
          setLocale={setLocale}
          copy={copy}
        />

        {tab === "today" && (
          <TodayView
            activeGoal={activeGoal}
            setActiveGoal={setActiveGoal}
            entries={entries}
            day={day}
            onLog={openLogger}
            selectedEntryId={selectedEntryId}
            setSelectedEntryId={setSelectedEntryId}
            locale={locale}
            copy={copy}
          />
        )}
        {tab === "foods" && (
          <FoodLibrary
            activeGoal={activeGoal}
            query={query}
            locale={locale}
            copy={copy}
            onLogTemplate={(templateId) => {
              openLogger(templateId);
            }}
          />
        )}
        {tab === "patterns" && <PatternsView activeGoal={activeGoal} locale={locale} copy={copy} />}
        {tab === "you" && (
          <ProfileView
            activeGoal={activeGoal}
            setActiveGoal={setActiveGoal}
            onLog={openLogger}
            locale={locale}
            copy={copy}
          />
        )}
      </main>

      <aside className="inspector" aria-label="Selected meal scorecard">
        <MealInspector assessment={selectedAssessment} onLog={openLogger} locale={locale} copy={copy} />
      </aside>

      <MobileNav active={tab} setTab={setTab} onLog={openLogger} copy={copy} />

      {loggerOpen && (
        <LogMealModal
          activeGoal={activeGoal}
          initialTemplateId={logTemplateId}
          onClose={() => setLoggerOpen(false)}
          onAdd={addMeal}
          locale={locale}
          copy={copy}
        />
      )}
    </div>
  );
}

function NavButton({ item, label, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      className={`rail-item ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={label}
    >
      <Icon size={21} strokeWidth={1.9} />
      <span>{label}</span>
    </button>
  );
}

function MobileNav({ active, setTab, onLog, copy }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile primary navigation">
      {navItems.slice(0, 2).map((item) => (
        <button
          key={item.id}
          className={active === item.id ? "is-active" : ""}
          type="button"
          onClick={() => setTab(item.id)}
        >
          <item.icon size={20} />
          <span>{copy.nav[item.id]}</span>
        </button>
      ))}
      <button className="mobile-scan" type="button" onClick={onLog} aria-label={copy.logMeal}>
        <Plus size={25} />
      </button>
      {navItems.slice(2).map((item) => (
        <button
          key={item.id}
          className={active === item.id ? "is-active" : ""}
          type="button"
          onClick={() => setTab(item.id)}
        >
          <item.icon size={20} />
          <span>{copy.nav[item.id]}</span>
        </button>
      ))}
    </nav>
  );
}

function TopBar({ goal, day, query, setQuery, onLog, locale, setLocale, copy }) {
  const GoalIcon = goal.icon;
  const g = goalText(goal, locale);
  return (
    <header className="topbar">
      <div className="topbar-title">
        <p className="eyebrow">Sway Nutrition</p>
        <h1>{copy.today}</h1>
      </div>
      <div className="goal-chip">
        <GoalIcon size={16} />
        <span>{g.label}</span>
      </div>
      <div className="micro-metrics" aria-label="Today nutrition summary">
        <span>{day.score}/100</span>
        <span>{day.facts.protein}g {copy.raw.protein}</span>
        <span>{day.facts.fiber}g {copy.raw.fiber}</span>
      </div>
      <label className="search-box">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchMeals} />
      </label>
      <LanguageToggle locale={locale} setLocale={setLocale} />
      <button className="primary-icon" type="button" onClick={onLog} aria-label={copy.logMeal}>
        <Camera size={20} />
      </button>
    </header>
  );
}

function LanguageToggle({ locale, setLocale }) {
  return (
    <div className="language-toggle" aria-label="Language">
      <button
        type="button"
        className={locale === "en" ? "is-active" : ""}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={locale === "zh" ? "is-active" : ""}
        onClick={() => setLocale("zh")}
      >
        中文
      </button>
    </div>
  );
}

function TodayView({
  activeGoal,
  setActiveGoal,
  entries,
  day,
  onLog,
  selectedEntryId,
  setSelectedEntryId,
  locale,
  copy,
}) {
  const goal = goalText(goalById[activeGoal], locale);
  const next = nextActionText(day.nextAction, locale, goalById[activeGoal]);
  const slots = mealTypes.map((mealType) => ({
    mealType,
    entries: entries.filter((entry) => entry.mealType === mealType),
  }));
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];
  const selectedAssessment = selectedEntry
    ? evaluateMeal(templateById[selectedEntry.templateId], activeGoal, selectedEntry)
    : day.assessments[0];
  return (
    <section className="view today-view app-home">
      <section className="today-command">
        <div className="command-main">
          <p className="eyebrow">{copy.todayPlan}</p>
          <h2>{next.title}</h2>
          <p>{next.body}</p>
          <div className="command-actions">
            <button className="wide-action inline-action" type="button" onClick={onLog}>
              {copy.logNextMeal} <ChevronRight size={17} />
            </button>
            <span>{entries.length} {copy.logged}</span>
          </div>
          <QuickCaptureStrip copy={copy} onLog={onLog} />
        </div>

        <div className="command-score">
          <ScoreDial score={day.score} grade={copy.grades[day.grade]} label={copy.todayScore} small />
          <div className="raw-facts">
            <Nutrient label={copy.raw.kcal} value={day.facts.kcal} />
            <Nutrient label={copy.raw.protein} value={`${day.facts.protein}g`} />
            <Nutrient label={copy.raw.fiber} value={`${day.facts.fiber}g`} />
          </div>
        </div>
      </section>

      <section className="app-grid">
        <div className="meal-board">
          <div className="section-title">
            <div>
              <p className="eyebrow">{copy.mealsToday}</p>
              <h2>{copy.mealSlots}</h2>
              <p>{copy.mealSlotsBody}</p>
            </div>
            <button type="button" className="ghost-button" onClick={onLog}>
              <ScanLine size={17} /> {copy.addMeal}
            </button>
          </div>

          <div className="meal-slots">
            {slots.map((slot) => (
              <MealSlot
                key={slot.mealType}
                mealType={slot.mealType}
                entries={slot.entries}
                activeGoal={activeGoal}
                locale={locale}
                copy={copy}
                selectedEntryId={selectedEntryId}
                onSelect={setSelectedEntryId}
                onLog={onLog}
              />
            ))}
          </div>

          <TodayResultCard assessment={selectedAssessment} onLog={onLog} locale={locale} copy={copy} />
        </div>

        <aside className="goal-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{copy.goalLens}</p>
              <h3>{goal.label}</h3>
            </div>
            <Target size={21} />
          </div>
          <p>{goal.promise}</p>
          <GoalPicker activeGoal={activeGoal} setActiveGoal={setActiveGoal} locale={locale} />

          <div className="score-explain-inline">
            <div className="panel-head">
              <div>
                <p className="eyebrow">{copy.scoreMovers}</p>
                <h3>{copy.changedNumber}</h3>
              </div>
            </div>
            <MoverList movers={day.movers.slice(0, 4)} locale={locale} />
          </div>

          <div className="rules-panel compact-rules">
            <div className="panel-head">
              <div>
                <p className="eyebrow">{copy.howReadsFood}</p>
                <h3>{copy.simpleMath}</h3>
              </div>
              <Gauge size={21} />
            </div>
            {copy.ruleRows.slice(0, 4).map(([label, value]) => (
              <RuleRow key={label} label={label} value={value} />
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function QuickCaptureStrip({ copy, onLog }) {
  const modes = [
    { label: copy.voiceInput, icon: Mic2 },
    { label: copy.photoInput, icon: Camera },
    { label: copy.textInput, icon: Keyboard },
    { label: copy.barcodeInput, icon: Barcode },
  ];

  return (
    <div className="quick-capture-strip">
      <div>
        <span>{copy.quickCapture}</span>
        <p>{copy.quickCaptureBody}</p>
      </div>
      <div className="capture-modes">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button key={mode.label} type="button" onClick={onLog}>
              <Icon size={16} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TodayResultCard({ assessment, onLog, locale, copy }) {
  if (!assessment) return null;
  const meal = mealText(assessment.template, locale);
  const next = nextActionText(assessment.nextAction, locale, assessment.goal);
  const topMovers = assessment.movers.slice(0, 3);

  return (
    <section className="today-result-card" aria-label={copy.liveResult}>
      <div className="result-visual">
        <ImageStack images={assessment.template.images} />
      </div>
      <div className="result-copy">
        <p className="eyebrow">{copy.liveResult}</p>
        <div className="result-title-row">
          <h3>{meal.name}</h3>
          <div className="result-score-pill">
            <strong>{assessment.score}</strong>
            <span>{copy.grades[assessment.grade]}</span>
          </div>
        </div>
        <p>{meal.description}</p>
        <div className="result-movers" aria-label={copy.whyChanged}>
          {topMovers.map((mover) => (
            <span
              key={`${mover.label}-${mover.points}`}
              className={mover.points >= 0 ? "is-positive" : "is-negative"}
            >
              {formatSigned(mover.points)} {moverLabel(mover.label, locale)}
            </span>
          ))}
        </div>
        <div className="result-next">
          <span>{copy.nextMeal}</span>
          <strong>{next.title}</strong>
        </div>
      </div>
      <button className="wide-action result-action" type="button" onClick={onLog}>
        {copy.logNextMeal} <Plus size={17} />
      </button>
    </section>
  );
}

function MealSlot({
  mealType,
  entries,
  activeGoal,
  locale,
  copy,
  selectedEntryId,
  onSelect,
  onLog,
}) {
  const assessments = entries.map((entry) => ({
    entry,
    assessment: evaluateMeal(templateById[entry.templateId], activeGoal, entry),
  }));
  const slotScore = assessments.length
    ? Math.round(assessments.reduce((sum, item) => sum + item.assessment.score, 0) / assessments.length)
    : null;
  const defaultTemplate = mealTemplates.find((meal) => meal.defaultMeal === mealType) ?? mealTemplates[0];

  return (
    <article className={`meal-slot ${entries.length ? "has-entry" : "is-empty"}`}>
      <header className="meal-slot-head">
        <div>
          <strong>{mealTypeText(mealType, locale)}</strong>
          <span>{entries.length ? `${entries.length} ${copy.logged}` : copy.emptySlot}</span>
        </div>
        {slotScore ? (
          <div className="slot-score">
            <strong>{slotScore}</strong>
            <span>{copy.score}</span>
          </div>
        ) : (
          <button type="button" className="slot-add" onClick={() => onLog(defaultTemplate.id)}>
            <Plus size={15} /> {copy.addHere}
          </button>
        )}
      </header>

      {assessments.length > 0 ? (
        <div className="slot-entry-list">
          {assessments.map(({ entry, assessment }) => (
            <SlotEntryRow
              key={entry.id}
              entry={entry}
              assessment={assessment}
              locale={locale}
              copy={copy}
              selected={selectedEntryId === entry.id}
              onSelect={() => onSelect(entry.id)}
            />
          ))}
        </div>
      ) : (
        <button type="button" className="empty-meal-action" onClick={() => onLog(defaultTemplate.id)}>
          <ImageStack images={defaultTemplate.images} compact />
          <span>{copy.addMeal}</span>
        </button>
      )}
    </article>
  );
}

function SlotEntryRow({ entry, assessment, locale, copy, selected, onSelect }) {
  const meal = mealText(assessment.template, locale);
  const topMover = assessment.movers[0];

  return (
    <button className={`slot-entry-row ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="slot-time">{entry.time}</span>
      <span className="slot-food">
        <strong>{meal.name}</strong>
        <small>{portionText(entry.portion, locale)} {locale === "zh" ? "份量" : "portion"}</small>
      </span>
      <span className="slot-row-score">
        <strong>{assessment.score}</strong>
        <small>{copy.grades[assessment.grade]}</small>
      </span>
      <div className="slot-entry-detail">
        <ImageStack images={assessment.template.images} compact />
        <span className="slot-mover">
          {topMover
            ? `${formatSigned(topMover.points)} ${moverLabel(topMover.label, locale)}`
            : locale === "zh"
              ? "暂无影响项"
              : "No mover"}
        </span>
      </div>
    </button>
  );
}

function GoalPicker({ activeGoal, setActiveGoal, locale }) {
  return (
    <div className="goal-picker" aria-label="Choose nutrition goal">
      {goals.map((goal) => {
        const Icon = goal.icon;
        const g = goalText(goal, locale);
        return (
          <button
            key={goal.id}
            type="button"
            className={activeGoal === goal.id ? "is-active" : ""}
            onClick={() => setActiveGoal(goal.id)}
          >
            <Icon size={16} />
            <span>{g.short}</span>
          </button>
        );
      })}
    </div>
  );
}

function MealEntry({ entry, activeGoal, locale, copy, selected, onSelect }) {
  const template = templateById[entry.templateId];
  const m = mealText(template, locale);
  const assessment = evaluateMeal(template, activeGoal, entry);
  const topMover = assessment.movers[0];

  return (
    <button className={`entry-card ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <div className="entry-time">
        <span>{entry.time}</span>
        <small>{mealTypeText(entry.mealType, locale)}</small>
      </div>
      <ImageStack images={template.images} compact />
      <div className="entry-main">
        <strong>{m.name}</strong>
        <span>{portionText(entry.portion, locale)} {locale === "zh" ? "份量" : "portion"}</span>
      </div>
      <div className="entry-score">
        <strong>{assessment.score}</strong>
        <span>{copy.grades[assessment.grade]}</span>
      </div>
      <div className={`entry-mover ${topMover?.points >= 0 ? "is-positive" : "is-negative"}`}>
        {topMover
          ? `${formatSigned(topMover.points)} ${moverLabel(topMover.label, locale)}`
          : locale === "zh"
            ? "暂无影响项"
            : "No mover"}
      </div>
    </button>
  );
}

function FoodLibrary({ activeGoal, query, locale, copy, onLogTemplate }) {
  const filtered = mealTemplates.filter((meal) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [meal.name, meal.family, meal.description, meal.nameZh, meal.familyZh, meal.descriptionZh]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return (
    <section className="view">
      <div className="section-title">
        <div>
          <p className="eyebrow">{copy.foodLibrary}</p>
          <h2>{copy.mealsScored}</h2>
        </div>
      </div>
      <div className="food-grid">
        {filtered.map((meal) => {
          const m = mealText(meal, locale);
          const assessment = evaluateMeal(meal, activeGoal, {
            mealType: meal.defaultMeal,
            portion: "normal",
          });
          return (
            <article key={meal.id} className="food-tile">
              <div className="tile-head">
                <span>{m.family}</span>
                <strong>{assessment.score}</strong>
              </div>
              <ImageStack images={meal.images} />
              <h3>{m.name}</h3>
              <p>{m.description}</p>
              <MoverList movers={assessment.movers.slice(0, 3)} compact locale={locale} />
              <button type="button" onClick={() => onLogTemplate(meal.id)}>
                {copy.logThis} <Plus size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PatternsView({ activeGoal, locale, copy }) {
  const goal = goalText(goalById[activeGoal], locale);
  const average = Math.round(weeklyPattern.reduce((sum, day) => sum + day.score, 0) / weeklyPattern.length);
  const patternCards =
    locale === "zh"
      ? [
          {
            icon: Check,
            title: "蛋白质帮上忙",
            value: "4 天",
            text: "只要蛋白质是可见的，分数基本都能留在 72 以上。",
          },
          {
            icon: Flame,
            title: "甜食单独出现会扣分",
            value: "2 次加餐",
            text: "问题不是甜，而是甜食单独撑起了加餐。",
          },
          {
            icon: Moon,
            title: "晚餐更轻",
            value: "3 晚",
            text: "清爽配菜让晚餐支持目标，但不用再加规则。",
          },
        ]
      : [
          {
            icon: Check,
            title: "Protein helped",
            value: "4 days",
            text: "When protein was visible, the score stayed above 72.",
          },
          {
            icon: Flame,
            title: "Sweet alone lowered",
            value: "2 snacks",
            text: "The issue was not sweetness. It was sweetness carrying the snack by itself.",
          },
          {
            icon: Moon,
            title: "Dinner stayed lighter",
            value: "3 nights",
            text: "Fresh sides helped dinner support the goal without extra rules.",
          },
        ];
  return (
    <section className="view">
      <div className="section-title">
        <div>
          <p className="eyebrow">{copy.patterns}</p>
          <h2>{copy.weeklySignals}</h2>
        </div>
        <div className="pattern-average">
          <span>{goal.short}</span>
          <strong>{average}</strong>
        </div>
      </div>
      <div className="week-strip">
        {weeklyPattern.map((day) => (
          <article key={day.day} className="day-card">
            <span>{day.day}</span>
            <strong>{day.score}</strong>
            <div className="score-line">
              <i style={{ width: `${day.score}%` }} />
            </div>
            <ImageStack images={day.meals.map((id) => templateById[id].image)} compact />
            <p>{moverLabel(day.mover, locale)}</p>
          </article>
        ))}
      </div>
      <div className="pattern-grid">
        {patternCards.map((card) => (
          <PatternCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

function PatternCard({ icon: Icon, title, value, text }) {
  return (
    <article className="pattern-card">
      <div className="soft-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{text}</p>
      </div>
    </article>
  );
}

function ProfileView({ activeGoal, setActiveGoal, onLog, locale, copy }) {
  const goal = goalById[activeGoal];
  const g = goalText(goal, locale);
  return (
    <section className="view">
      <div className="profile-hero">
        <div className="profile-plate">
          <img src={goal.id === "sleep-support" ? cucumber : bowl} alt="" />
        </div>
        <div>
          <p className="eyebrow">{copy.onboarding}</p>
          <h2>{copy.goalChoosesLens}</h2>
          <p>{copy.onboardingBody}</p>
          <GoalPicker activeGoal={activeGoal} setActiveGoal={setActiveGoal} locale={locale} />
          <button className="wide-action inline-action" type="button" onClick={onLog}>
            {copy.tryFlow} <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="settings-grid">
        <SettingRow label={copy.primaryGoal} value={g.label} />
        <SettingRow label={copy.eatingRhythm} value={copy.rhythmValue} />
        <SettingRow label={copy.outputFormat} value={copy.outputValue} />
        <SettingRow label={copy.dataDensity} value={copy.dataValue} />
      </div>
    </section>
  );
}

function MealInspector({ assessment, onLog, locale, copy }) {
  if (!assessment) return null;
  const meal = mealText(assessment.template, locale);
  const goal = goalText(assessment.goal, locale);
  const next = nextActionText(assessment.nextAction, locale, assessment.goal);
  return (
    <div className="inspector-inner">
      <div className="inspector-header">
        <div>
          <p className="eyebrow">{copy.mealScorecard}</p>
          <h2>{meal.name}</h2>
        </div>
        <img src={assessment.template.image} alt="" />
      </div>

      <ScoreDial score={assessment.score} grade={copy.grades[assessment.grade]} label={goal.short} small />
      <p className="food-note">{meal.description}</p>

      <div className="inspector-block">
        <div className="fit-title">
          <Target size={17} />
          <span>{goal.scoreLabel}</span>
        </div>
        <MoverList movers={assessment.movers.slice(0, 5)} locale={locale} />
      </div>

      <div className="raw-facts inspector-facts">
        <Nutrient label={copy.raw.kcal} value={assessment.facts.kcal} />
        <Nutrient label={copy.raw.protein} value={`${assessment.facts.protein}g`} />
        <Nutrient label={copy.raw.fiber} value={`${assessment.facts.fiber}g`} />
      </div>

      <div className="watch-box">
        <span>{copy.inspectorNext}</span>
        <h3>{next.title}</h3>
        <p>{next.body}</p>
      </div>

      <button className="wide-action" type="button" onClick={onLog}>
        {copy.logAnother} <Plus size={17} />
      </button>
    </div>
  );
}

function LogMealModal({ activeGoal, initialTemplateId, onClose, onAdd, locale, copy }) {
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [mealType, setMealType] = useState(templateById[initialTemplateId].defaultMeal);
  const [portion, setPortion] = useState("normal");
  const template = templateById[templateId];
  const meal = mealText(template, locale);
  const assessment = evaluateMeal(template, activeGoal, { mealType, portion });

  function chooseTemplate(id) {
    setTemplateId(id);
    setMealType(templateById[id].defaultMeal);
  }

  return (
    <div className="modal-backdrop">
      <div className="log-modal" role="dialog" aria-modal="true" aria-label={copy.logMeal}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{copy.logMeal}</p>
            <h2>{copy.modalTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="log-layout">
          <section className="log-picker">
            <div className="modal-step">
              <span>1</span>
              <strong>{copy.meal}</strong>
            </div>
            <div className="template-list">
              {mealTemplates.map((meal) => (
                <button
                  key={meal.id}
                  type="button"
                  className={templateId === meal.id ? "is-active" : ""}
                  onClick={() => chooseTemplate(meal.id)}
                >
                  <img src={meal.image} alt="" />
                  <span>{mealText(meal, locale).name}</span>
                </button>
              ))}
            </div>

            <div className="modal-step">
              <span>2</span>
              <strong>{copy.context}</strong>
            </div>
            <div className="choice-row">
              {mealTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={mealType === type ? "is-active" : ""}
                  onClick={() => setMealType(type)}
                >
                  <Clock3 size={15} />
                  {mealTypeText(type, locale)}
                </button>
              ))}
            </div>
            <div className="choice-row">
              {portions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={portion === item.id ? "is-active" : ""}
                  onClick={() => setPortion(item.id)}
                >
                  <SlidersHorizontal size={15} />
                  {locale === "zh" ? item.labelZh : item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="preview-card">
            <div className="preview-visual">
              <ImageStack images={template.images} />
            </div>
            <ScoreDial score={assessment.score} grade={copy.grades[assessment.grade]} label={copy.preview} small />
            <h3>{meal.name}</h3>
            <p>{meal.description}</p>
            <MoverList movers={assessment.movers.slice(0, 4)} locale={locale} />
            <div className="raw-facts">
              <Nutrient label={copy.raw.kcal} value={assessment.facts.kcal} />
              <Nutrient label={copy.raw.protein} value={`${assessment.facts.protein}g`} />
              <Nutrient label={copy.raw.fiber} value={`${assessment.facts.fiber}g`} />
            </div>
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            {copy.cancel}
          </button>
          <button
            type="button"
            className="wide-action"
            onClick={() => onAdd({ templateId, mealType, portion })}
          >
            {copy.addToToday} <Plus size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreDial({ score, grade, label, small = false }) {
  return (
    <div className={`score-dial ${small ? "is-small" : ""}`} style={{ "--score": score }}>
      <div className="score-ring">
        <strong>{score}</strong>
        <span>/100</span>
      </div>
      <div>
        <span>{label}</span>
        <em>{grade}</em>
      </div>
    </div>
  );
}

function MoverList({ movers, compact = false, locale = "en" }) {
  return (
    <div className={`mover-list ${compact ? "is-compact" : ""}`}>
      {movers.map((mover) => (
        <div key={`${mover.label}-${mover.points}`} className={mover.points >= 0 ? "is-positive" : "is-negative"}>
          <strong>{formatSigned(mover.points)}</strong>
          <span>{moverLabel(mover.label, locale)}</span>
          {!compact && <small>{evidenceText(mover.evidence, locale)}</small>}
        </div>
      ))}
    </div>
  );
}

function Nutrient({ label, value }) {
  return (
    <div className="nutrient">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ImageStack({ images, compact = false }) {
  return (
    <div className={`image-stack ${compact ? "is-compact" : ""}`}>
      {images.slice(0, 3).map((image, index) => (
        <img key={`${image}-${index}`} src={image} alt="" />
      ))}
    </div>
  );
}

function RuleRow({ label, value }) {
  return (
    <div className="rule-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettingRow({ label, value }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
