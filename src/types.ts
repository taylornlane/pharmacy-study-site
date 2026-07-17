// A single labeled fact about a drug, e.g. { key: "side_effects", label: "Side Effects", value: "..." }
export interface FieldEntry {
  key: string;   // stable machine key derived from the label, used to track SRS state
  label: string; // whatever label the person actually used/typed - fully flexible
  value: string;
}

export interface DrugRecord {
  id: string;
  term: string; // the drug name
  fields: FieldEntry[];
}

export type NewDrugInput = Omit<DrugRecord, "id">;

// A patient case scenario: a stem (presentation) plus one or more questions.
// Free-response and self-graded, since there's no API to check clinical reasoning.
export interface CaseQuestion {
  id: string;
  prompt: string;
  answer: string; // model answer / rationale to reveal
}

export interface PatientCase {
  id: string;
  stem: string;
  questions: CaseQuestion[];
}

export type NewCaseInput = {
  stem: string;
  questions: { prompt: string; answer: string }[];
};

// A drug-drug interaction between two drugs already in the same deck.
// Self-graded like patient cases, since interaction mechanisms/management
// are free text rather than something to check automatically.
export type InteractionSeverity = "minor" | "moderate" | "major";

export interface DrugInteraction {
  id: string;
  drugAId: string;
  drugBId: string;
  severity: InteractionSeverity;
  description: string;
}

export type NewInteractionInput = Omit<DrugInteraction, "id">;

// Spaced-repetition state, tracked per atomic study unit (a drug+field pair,
// or a case+question pair) rather than per drug/case, since someone might
// know a drug's class but not its side effects, or nail one case question
// but miss another.
export interface FactSrsState {
  box: number; // 1 (new/hardest) -> 5 (mastered)
  dueAt: number;
  timesSeen: number;
  timesCorrect: number;
  lastResult?: "again" | "good";
}

export type DeckKind = "drugs" | "cases";

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  kind: DeckKind;
  drugs: DrugRecord[];
  cases: PatientCase[];
  interactions: DrugInteraction[];
  srs: Record<string, FactSrsState>; // keyed by `${itemId}::${subKey}`
}

export function factId(drugId: string, fieldKey: string): string {
  return `${drugId}::${fieldKey}`;
}

export function caseFactId(caseId: string, questionId: string): string {
  return `${caseId}::${questionId}`;
}

export function interactionFactId(interactionId: string): string {
  return `ix::${interactionId}`;
}
