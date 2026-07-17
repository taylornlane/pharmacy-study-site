export interface MatchPair {
  id: string;
  term: string;
  definition: string;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickMatchRound(pairs: MatchPair[], size = 6): MatchPair[] {
  return shuffle(pairs).slice(0, Math.min(size, pairs.length));
}
