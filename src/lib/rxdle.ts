// A daily Wordle-style puzzle where the answer is a generic drug name.
// Everything is deterministic from the calendar date (no server, no
// randomness at runtime) so every player sees the same word on the same
// day, same as real Wordle.

export const MAX_GUESSES = 6;

// Generic drug names only (no brand names), 5-12 letters. Deliberately a
// mix of well-known and less common ones across drug classes so repeat
// players see variety.
const WORD_LIST = [
  "ASPIRIN", "INSULIN", "WARFARIN", "HEPARIN", "DIGOXIN", "MORPHINE", "FENTANYL", "KETAMINE",
  "LIDOCAINE", "ATROPINE", "EPINEPHRINE", "ALBUTEROL", "MONTELUKAST", "FLUTICASONE", "BUDESONIDE",
  "PREDNISONE", "METFORMIN", "GLIPIZIDE", "GLYBURIDE", "SITAGLIPTIN", "LISINOPRIL", "ENALAPRIL",
  "LOSARTAN", "VALSARTAN", "AMLODIPINE", "NIFEDIPINE", "DILTIAZEM", "VERAPAMIL", "METOPROLOL",
  "ATENOLOL", "CARVEDILOL", "PROPRANOLOL", "HYDRALAZINE", "CLONIDINE", "FUROSEMIDE", "ATORVASTATIN",
  "SIMVASTATIN", "ROSUVASTATIN", "PRAVASTATIN", "EZETIMIBE", "CLOPIDOGREL", "APIXABAN", "RIVAROXABAN",
  "DABIGATRAN", "ENOXAPARIN", "OMEPRAZOLE", "PANTOPRAZOLE", "RANITIDINE", "FAMOTIDINE", "SUCRALFATE",
  "ONDANSETRON", "LOPERAMIDE", "DOCUSATE", "SENNA", "BISACODYL", "LACTULOSE", "AMOXICILLIN",
  "AMPICILLIN", "CEPHALEXIN", "CEFTRIAXONE", "AZITHROMYCIN", "DOXYCYCLINE", "CLINDAMYCIN",
  "VANCOMYCIN", "FLUCONAZOLE", "ACYCLOVIR", "SERTRALINE", "FLUOXETINE", "CITALOPRAM", "PAROXETINE",
  "VENLAFAXINE", "DULOXETINE", "BUPROPION", "TRAZODONE", "MIRTAZAPINE", "ALPRAZOLAM", "LORAZEPAM",
  "DIAZEPAM", "CLONAZEPAM", "ZOLPIDEM", "BUSPIRONE", "HALOPERIDOL", "RISPERIDONE", "QUETIAPINE",
  "OLANZAPINE", "LITHIUM", "VALPROATE", "LAMOTRIGINE", "PHENYTOIN", "GABAPENTIN", "PREGABALIN",
  "TRAMADOL", "OXYCODONE", "HYDROCODONE", "IBUPROFEN", "NAPROXEN", "CELECOXIB", "ALLOPURINOL",
  "COLCHICINE", "METHIMAZOLE", "TAMSULOSIN", "FINASTERIDE", "SILDENAFIL", "LORATADINE", "CETIRIZINE",
  "GUAIFENESIN",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function pickDailyWord(dateStr: string): string {
  const h = hashString(dateStr);
  return WORD_LIST[h % WORD_LIST.length];
}

export type LetterStatus = "correct" | "present" | "absent";

// Standard two-pass Wordle scoring: exact matches first, then leftover
// letters get "present" using a remaining-count table so duplicate letters
// (e.g. two O's) are handled correctly.
export function evaluateGuess(guess: string, answer: string): LetterStatus[] {
  const g = guess.toUpperCase().split("");
  const a = answer.toUpperCase().split("");
  const result: LetterStatus[] = new Array(g.length).fill("absent");
  const remaining: Record<string, number> = {};

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    const letter = g[i];
    if (remaining[letter] > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  }
  return result;
}

export function bestLetterStatuses(guesses: string[], answer: string): Record<string, LetterStatus> {
  const rank: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };
  const best: Record<string, LetterStatus> = {};
  for (const guess of guesses) {
    const statuses = evaluateGuess(guess, answer);
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toUpperCase();
      const status = statuses[i];
      if (!best[letter] || rank[status] > rank[best[letter]]) {
        best[letter] = status;
      }
    }
  }
  return best;
}

export interface RxdleState {
  date: string;
  guesses: string[];
  solved: boolean;
  failed: boolean;
  streak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
}

const KEY = "rxcards.rxdle.v1";

function dateMinusOneDay(dateStr: string): string {
  return new Date(new Date(dateStr).getTime() - 86400000).toISOString().slice(0, 10);
}

function defaultRxdleState(date: string): RxdleState {
  return { date, guesses: [], solved: false, failed: false, streak: 0, bestStreak: 0, lastCompletedDate: null };
}

export function loadRxdleState(today: string): RxdleState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultRxdleState(today);
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) {
      return {
        ...defaultRxdleState(today),
        streak: parsed.streak ?? 0,
        bestStreak: parsed.bestStreak ?? 0,
        lastCompletedDate: parsed.lastCompletedDate ?? null,
      };
    }
    return { ...defaultRxdleState(today), ...parsed };
  } catch {
    return defaultRxdleState(today);
  }
}

function saveRxdleState(state: RxdleState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function addRxdleGuess(today: string, guess: string, solved: boolean, exhausted: boolean): RxdleState {
  const state = loadRxdleState(today);
  state.date = today;
  state.guesses = [...state.guesses, guess.toUpperCase()];
  if (solved || exhausted) {
    state.solved = solved;
    state.failed = exhausted && !solved;
    if (solved) {
      state.streak = state.lastCompletedDate === dateMinusOneDay(today) ? state.streak + 1 : 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }
    state.lastCompletedDate = today;
  }
  saveRxdleState(state);
  return state;
}
