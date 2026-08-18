// Lightweight points/streak system so studying has a running score to beat.
// Everything lives in localStorage - there's no server, so "competing with
// yourself" means comparing against your own past sessions.

export interface SessionRecord {
  date: string; // YYYY-MM-DD
  mode: string; // "learn" | "cases" | "interactions" | "pk" | "match"
  points: number;
  correct: number;
  seen: number;
}

export interface GamificationState {
  totalPoints: number;
  currentStreakDays: number;
  bestStreakDays: number;
  lastStudyDate: string | null;
  sessions: SessionRecord[]; // most recent first
  highScores: Record<string, number>; // mode -> best value (meaning depends on mode)
  unlockedAchievements: Record<string, number>; // achievement id -> unix ms unlocked
}

const KEY = "rxcards.gamification.v1";
const MAX_SESSIONS = 50;

const POINTS_PER_CORRECT = 10;
const POINTS_PER_ATTEMPT = 2; // participation credit even when wrong
const PERFECT_SESSION_BONUS = 25;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function defaultState(): GamificationState {
  return {
    totalPoints: 0,
    currentStreakDays: 0,
    bestStreakDays: 0,
    lastStudyDate: null,
    sessions: [],
    highScores: {},
    unlockedAchievements: {},
  };
}

export function loadGamification(): GamificationState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveGamification(state: GamificationState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function bumpStreak(state: GamificationState): void {
  const today = todayStr();
  if (state.lastStudyDate === today) return;
  state.currentStreakDays = state.lastStudyDate === yesterdayStr() ? state.currentStreakDays + 1 : 1;
  state.bestStreakDays = Math.max(state.bestStreakDays, state.currentStreakDays);
  state.lastStudyDate = today;
}

// Call once per graded review (Learn, CaseStudy, InteractionQuiz, PK Practice).
export function awardReview(result: "again" | "good"): void {
  const state = loadGamification();
  bumpStreak(state);
  state.totalPoints += result === "good" ? POINTS_PER_CORRECT : POINTS_PER_ATTEMPT;
  saveGamification(state);
}

// Call once when a study session ends (on exit), logging a summary entry.
export function recordSessionComplete(seen: number, correct: number, mode: string): void {
  if (seen === 0) return;
  const state = loadGamification();
  bumpStreak(state);
  const bonus = correct === seen ? PERFECT_SESSION_BONUS : 0;
  state.totalPoints += bonus;
  const points = correct * POINTS_PER_CORRECT + (seen - correct) * POINTS_PER_ATTEMPT + bonus;
  state.sessions.unshift({ date: todayStr(), mode, points, correct, seen });
  state.sessions = state.sessions.slice(0, MAX_SESSIONS);
  saveGamification(state);
}

// A per-mode best score. Meaning depends on mode: for "typing" a higher
// number is better (arcade score); for "match" a lower number is better
// (fastest completion time in ms). Returns true when this call set a new best.
export function recordHighScore(mode: string, value: number, higherIsBetter = true): boolean {
  const state = loadGamification();
  const prev = state.highScores[mode];
  const isNew = prev === undefined || (higherIsBetter ? value > prev : value < prev);
  if (isNew) {
    state.highScores[mode] = value;
    saveGamification(state);
  }
  return isNew;
}

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  description: string;
  check: (state: GamificationState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-steps",
    icon: "🌱",
    label: "First Steps",
    description: "Complete your first study session.",
    check: (s) => s.sessions.length >= 1,
  },
  {
    id: "perfect-session",
    icon: "🎯",
    label: "Perfectionist",
    description: "Get a perfect score on a session of 5+ cards.",
    check: (s) => s.sessions.some((r) => r.seen >= 5 && r.correct === r.seen),
  },
  {
    id: "streak-3",
    icon: "🔥",
    label: "3-Day Streak",
    description: "Study three days in a row.",
    check: (s) => s.bestStreakDays >= 3,
  },
  {
    id: "streak-7",
    icon: "🔥🔥",
    label: "Week Warrior",
    description: "Study seven days in a row.",
    check: (s) => s.bestStreakDays >= 7,
  },
  {
    id: "century",
    icon: "💯",
    label: "Century Club",
    description: "Earn 100 total points.",
    check: (s) => s.totalPoints >= 100,
  },
  {
    id: "point-master",
    icon: "👑",
    label: "Point Master",
    description: "Earn 1,000 total points.",
    check: (s) => s.totalPoints >= 1000,
  },
  {
    id: "typing-novice",
    icon: "⌨️",
    label: "Typing Novice",
    description: "Score 100+ in Typing Attack.",
    check: (s) => (s.highScores.typing ?? 0) >= 100,
  },
  {
    id: "typing-ace",
    icon: "⚡",
    label: "Typing Ace",
    description: "Score 300+ in Typing Attack.",
    check: (s) => (s.highScores.typing ?? 0) >= 300,
  },
  {
    id: "speed-matcher",
    icon: "🏃",
    label: "Speed Matcher",
    description: "Finish a Match round in under 15 seconds.",
    check: (s) => s.highScores.match !== undefined && s.highScores.match <= 15000,
  },
  {
    id: "rxdle-solver",
    icon: "🟩",
    label: "Rxdle Solver",
    description: "Solve the daily Rx Wordle.",
    check: (s) => s.sessions.some((r) => r.mode === "rxdle" && r.correct > 0),
  },
  {
    id: "rxdle-regular",
    icon: "📅",
    label: "Rxdle Regular",
    description: "Solve the daily Rx Wordle 5 times.",
    check: (s) => s.sessions.filter((r) => r.mode === "rxdle" && r.correct > 0).length >= 5,
  },
  {
    id: "pk-pro",
    icon: "📐",
    label: "PK Pro",
    description: "Complete 10 PK Practice sessions.",
    check: (s) => s.sessions.filter((r) => r.mode === "pk").length >= 10,
  },
];

// Checks all achievement definitions against current state, unlocking any
// newly-earned ones. Call after any action that could complete one (session
// end, high score). Returns just the newly-unlocked achievements, for a
// "you earned a badge" callout in the calling screen.
export function evaluateAchievements(): Achievement[] {
  const state = loadGamification();
  const newly: Achievement[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.unlockedAchievements[achievement.id]) continue;
    if (achievement.check(state)) {
      state.unlockedAchievements[achievement.id] = Date.now();
      newly.push(achievement);
    }
  }
  if (newly.length > 0) saveGamification(state);
  return newly;
}

export function allAchievementsStatus(): { achievement: Achievement; unlockedAt: number | null }[] {
  const state = loadGamification();
  return ACHIEVEMENTS.map((achievement) => ({
    achievement,
    unlockedAt: state.unlockedAchievements[achievement.id] ?? null,
  }));
}
