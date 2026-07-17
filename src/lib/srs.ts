import type { Deck, FactSrsState } from "../types";

// 5-box Leitner system. Higher box = better known = seen less often.
const BOX_INTERVALS_MS: Record<number, number> = {
  1: 0,
  2: 1000 * 60 * 10, // 10 min
  3: 1000 * 60 * 60 * 6, // 6 hours
  4: 1000 * 60 * 60 * 24, // 1 day
  5: 1000 * 60 * 60 * 24 * 4, // 4 days
};

export function defaultSrsState(): FactSrsState {
  return { box: 1, dueAt: Date.now(), timesSeen: 0, timesCorrect: 0 };
}

export function getSrsState(deck: Deck, id: string): FactSrsState {
  return deck.srs[id] ?? defaultSrsState();
}

// A StateGetter abstracts away *which* deck a study unit's SRS state lives
// in. For a single-set study session it's just a lookup into that one
// deck's srs map; for cram mode (studying across many sets at once) it
// looks up the right originating deck per unit.
export type StateGetter = (id: string) => FactSrsState;

export function stateGetterForDeck(deck: Deck): StateGetter {
  return (id: string) => getSrsState(deck, id);
}

export function isMasteredState(state: FactSrsState): boolean {
  return state.box >= 5;
}

export function isDueState(state: FactSrsState, now = Date.now()): boolean {
  return state.dueAt <= now;
}

export function reviewState(state: FactSrsState, result: "again" | "good"): FactSrsState {
  const nextBox = result === "good" ? Math.min(5, state.box + 1) : Math.max(1, state.box - 1);
  const now = Date.now();
  return {
    box: nextBox,
    dueAt: now + (BOX_INTERVALS_MS[nextBox] ?? 0),
    lastResult: result,
    timesSeen: state.timesSeen + 1,
    timesCorrect: state.timesCorrect + (result === "good" ? 1 : 0),
  };
}

// Generic over any study unit with a stable `id` - used for drug fact cards,
// case question units, and cram-mode units pooled across multiple sets.
export function buildLearnQueue<T extends { id: string }>(units: T[], getState: StateGetter): T[] {
  const now = Date.now();
  return units
    .map((u) => ({ unit: u, state: getState(u.id) }))
    .filter(({ state }) => isDueState(state, now))
    .sort((a, b) => a.state.box - b.state.box || a.state.dueAt - b.state.dueAt)
    .map(({ unit }) => unit);
}

export function deckMasteryPercent<T extends { id: string }>(units: T[], getState: StateGetter): number {
  if (units.length === 0) return 0;
  const mastered = units.filter((u) => isMasteredState(getState(u.id))).length;
  return Math.round((mastered / units.length) * 100);
}

export function splitByMastery<T extends { id: string }>(units: T[], getState: StateGetter): { known: T[]; practice: T[] } {
  const known: T[] = [];
  const practice: T[] = [];
  for (const u of units) {
    const state = getState(u.id);
    (state.box >= 4 ? known : practice).push(u);
  }
  return { known, practice };
}
