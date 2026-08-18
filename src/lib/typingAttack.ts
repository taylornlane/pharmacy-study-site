// Pure scoring/pacing rules for the Typing Attack arcade game, kept apart
// from the component so the difficulty curve can be tuned/tested in one place.

export const STARTING_LIVES = 3;
export const MAX_GUESS_MS = 9000;
export const MIN_GUESS_MS = 4000;
export const MS_FASTER_PER_CORRECT = 300;

const BASE_POINTS = 20;
const SPEED_BONUS_MAX = 30;
const COMBO_BONUS_PER = 5;
const COMBO_BONUS_CAP = 10;

export function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export function isCorrectAnswer(input: string, term: string): boolean {
  return normalizeAnswer(input) === normalizeAnswer(term);
}

// Round duration shortens as the streak of correct answers grows, floored
// so it never becomes unfairly fast.
export function durationForStreak(correctCount: number): number {
  return Math.max(MIN_GUESS_MS, MAX_GUESS_MS - correctCount * MS_FASTER_PER_CORRECT);
}

// Points for one correct answer: a flat base, a bonus for how much time was
// left (rewards speed), and a bonus that grows with the current combo.
export function pointsForCorrectAnswer(timeLeftMs: number, durationMs: number, combo: number): number {
  const timeFraction = durationMs > 0 ? Math.max(0, Math.min(1, timeLeftMs / durationMs)) : 0;
  const speedBonus = Math.round(timeFraction * SPEED_BONUS_MAX);
  const comboBonus = Math.min(combo, COMBO_BONUS_CAP) * COMBO_BONUS_PER;
  return BASE_POINTS + speedBonus + comboBonus;
}
