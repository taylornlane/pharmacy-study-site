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
  return { totalPoints: 0, currentStreakDays: 0, bestStreakDays: 0, lastStudyDate: null, sessions: [] };
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
