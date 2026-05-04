import { Leaf, Moon, Scale, Smile, Sparkles, Target, Zap } from "lucide-react";

export const GOAL_CATALOG = [
  {
    id: "weight",
    label: "Weight",
    metricGoalId: "weight-management",
    headline: "Today looks light",
    subline: "Your meals are staying filling without stacking extra load.",
    status: "Light zone",
    Icon: Scale,
  },
  {
    id: "muscle",
    label: "Muscle",
    metricGoalId: "workout-support",
    headline: "Protein is doing work",
    subline: "A clear base today, with room to support recovery.",
    status: "Build zone",
    Icon: Target,
  },
  {
    id: "glow",
    label: "Glow",
    metricGoalId: "skin-state",
    headline: "Clean glow today",
    subline: "Sugar and oil are not carrying the day.",
    status: "Fresh zone",
    Icon: Sparkles,
  },
  {
    id: "energy",
    label: "Energy",
    metricGoalId: "afternoon-energy",
    headline: "Steady fuel",
    subline: "Your meals are keeping energy smooth.",
    status: "Good zone",
    Icon: Zap,
  },
  {
    id: "sleep",
    label: "Sleep",
    metricGoalId: "sleep-burden",
    headline: "Dinner can land light",
    subline: "Keep the evening simple so sleep has less to process.",
    status: "Easy night",
    Icon: Moon,
  },
  {
    id: "digestion",
    label: "Digestion",
    metricGoalId: "gut-comfort",
    headline: "Comfort is recovering",
    subline: "Fresh volume is helping the day feel less heavy.",
    status: "Calm gut",
    Icon: Leaf,
  },
  {
    id: "mood",
    label: "Mood",
    metricGoalId: "craving-control",
    headline: "Cravings look calm",
    subline: "You are not asking sugar to carry the whole day.",
    status: "Soft mood",
    Icon: Smile,
  },
];

export const GOAL_ACTIONS = {
  weight: [
    { id: "scan-dinner", label: "Scan dinner", detail: "Keep the next meal visible", value: "1 meal", action: "Scan" },
    { id: "water", label: "Add water", detail: "Move hydration to 2.0 L", value: "350 ml", action: "Add" },
    { id: "weight", label: "Log weight", detail: "One quick check-in", value: "30 sec", action: "Log" },
  ],
  muscle: [
    { id: "protein", label: "Scan protein", detail: "Make the recovery base clear", value: "25 g", action: "Scan" },
    { id: "water", label: "Add water", detail: "Training days need more fluid", value: "350 ml", action: "Add" },
    { id: "note", label: "Mark workout", detail: "Tie meals to training", value: "1 tap", action: "Mark" },
  ],
  glow: [
    { id: "scan-sugar", label: "Scan sweet snacks", detail: "Keep sugar visible", value: "today", action: "Scan" },
    { id: "water", label: "Add water", detail: "Help the day stay fresh", value: "350 ml", action: "Add" },
    { id: "photo", label: "Add skin note", detail: "Track glow with food", value: "10 sec", action: "Note" },
  ],
  energy: [
    { id: "scan-lunch", label: "Scan next meal", detail: "Catch the afternoon dip early", value: "1 meal", action: "Scan" },
    { id: "water", label: "Add water", detail: "Lift hydration to 2.0 L", value: "350 ml", action: "Add" },
    { id: "ask", label: "Ask Vilo", detail: "What should I eat before work?", value: "AI", action: "Ask" },
  ],
  sleep: [
    { id: "scan-dinner", label: "Scan dinner", detail: "Watch late oil and spice", value: "1 meal", action: "Scan" },
    { id: "cutoff", label: "Set caffeine cut-off", detail: "Protect tonight", value: "2 pm", action: "Set" },
    { id: "water", label: "Add water", detail: "Finish earlier, not late", value: "250 ml", action: "Add" },
  ],
  digestion: [
    { id: "scan-spice", label: "Scan heavy foods", detail: "Flag oil, spice, and lactose", value: "today", action: "Scan" },
    { id: "fresh", label: "Add fresh side", detail: "Balance the next meal", value: "1 item", action: "Plan" },
    { id: "water", label: "Add water", detail: "Keep comfort moving", value: "350 ml", action: "Add" },
  ],
  mood: [
    { id: "scan-snack", label: "Scan snack", detail: "See if sugar is driving mood", value: "1 snack", action: "Scan" },
    { id: "protein", label: "Add steady food", detail: "Choose protein before sweets", value: "1 item", action: "Plan" },
    { id: "ask", label: "Ask Vilo", detail: "Find a softer treat", value: "AI", action: "Ask" },
  ],
};
