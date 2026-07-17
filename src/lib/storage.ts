import type {
  Deck,
  DrugRecord,
  NewDrugInput,
  PatientCase,
  NewCaseInput,
  DrugInteraction,
  NewInteractionInput,
  FactSrsState,
} from "../types";
import { interactionFactId } from "../types";
import { uid } from "./uid";

const STORAGE_KEY = "rxcards.decks.v2";

function normalizeDeck(raw: any): Deck {
  // Backward-compat for decks saved before "kind"/"cases" existed.
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.createdAt,
    kind: raw.kind ?? "drugs",
    drugs: raw.drugs ?? [],
    cases: raw.cases ?? [],
    interactions: raw.interactions ?? [],
    srs: raw.srs ?? {},
  };
}

export function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeDeck);
  } catch {
    return [];
  }
}

export function saveDecks(decks: Deck[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function makeDrug(input: NewDrugInput): DrugRecord {
  return { ...input, id: uid() };
}

function makeCase(input: NewCaseInput): PatientCase {
  return {
    id: uid(),
    stem: input.stem,
    questions: input.questions.map((q) => ({ ...q, id: uid() })),
  };
}

export function createDeck(name: string, initialDrugs: NewDrugInput[] = []): Deck {
  const deck: Deck = {
    id: uid(),
    name,
    createdAt: Date.now(),
    kind: "drugs",
    drugs: initialDrugs.map(makeDrug),
    cases: [],
    interactions: [],
    srs: {},
  };
  const decks = loadDecks();
  decks.unshift(deck);
  saveDecks(decks);
  return deck;
}

export function createCaseDeck(name: string, initialCases: NewCaseInput[] = []): Deck {
  const deck: Deck = {
    id: uid(),
    name,
    createdAt: Date.now(),
    kind: "cases",
    drugs: [],
    cases: initialCases.map(makeCase),
    interactions: [],
    srs: {},
  };
  const decks = loadDecks();
  decks.unshift(deck);
  saveDecks(decks);
  return deck;
}

export function deleteDeck(deckId: string): void {
  saveDecks(loadDecks().filter((d) => d.id !== deckId));
}

export function renameDeck(deckId: string, name: string): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (deck) {
    deck.name = name;
    saveDecks(decks);
  }
}

// --- Drug decks ---

export function addDrugsToDeck(deckId: string, inputs: NewDrugInput[]): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.drugs.push(...inputs.map(makeDrug));
  saveDecks(decks);
}

export function updateDrug(deckId: string, drug: DrugRecord): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  const idx = deck.drugs.findIndex((d) => d.id === drug.id);
  if (idx >= 0) {
    deck.drugs[idx] = drug;
    saveDecks(decks);
  }
}

export function deleteDrug(deckId: string, drugId: string): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.drugs = deck.drugs.filter((d) => d.id !== drugId);
  for (const key of Object.keys(deck.srs)) {
    if (key.startsWith(`${drugId}::`)) delete deck.srs[key];
  }
  const droppedInteractions = deck.interactions.filter((ix) => ix.drugAId === drugId || ix.drugBId === drugId);
  deck.interactions = deck.interactions.filter((ix) => ix.drugAId !== drugId && ix.drugBId !== drugId);
  for (const ix of droppedInteractions) {
    delete deck.srs[interactionFactId(ix.id)];
  }
  saveDecks(decks);
}

// --- Case decks ---

export function addCasesToDeck(deckId: string, inputs: NewCaseInput[]): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.cases.push(...inputs.map(makeCase));
  saveDecks(decks);
}

export function updateCase(deckId: string, patientCase: PatientCase): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  const idx = deck.cases.findIndex((c) => c.id === patientCase.id);
  if (idx >= 0) {
    deck.cases[idx] = patientCase;
    saveDecks(decks);
  }
}

export function deleteCase(deckId: string, caseId: string): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.cases = deck.cases.filter((c) => c.id !== caseId);
  for (const key of Object.keys(deck.srs)) {
    if (key.startsWith(`${caseId}::`)) delete deck.srs[key];
  }
  saveDecks(decks);
}

// --- Drug-drug interactions ---

function makeInteraction(input: NewInteractionInput): DrugInteraction {
  return { ...input, id: uid() };
}

export function addInteraction(deckId: string, input: NewInteractionInput): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.interactions.push(makeInteraction(input));
  saveDecks(decks);
}

export function updateInteraction(deckId: string, interaction: DrugInteraction): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  const idx = deck.interactions.findIndex((ix) => ix.id === interaction.id);
  if (idx >= 0) {
    deck.interactions[idx] = interaction;
    saveDecks(decks);
  }
}

export function deleteInteraction(deckId: string, interactionId: string): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.interactions = deck.interactions.filter((ix) => ix.id !== interactionId);
  delete deck.srs[interactionFactId(interactionId)];
  saveDecks(decks);
}

// --- Shared ---

export function setFactSrsState(deckId: string, factId: string, state: FactSrsState): void {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.srs[factId] = state;
  saveDecks(decks);
}

export function getDeck(deckId: string): Deck | undefined {
  return loadDecks().find((d) => d.id === deckId);
}
