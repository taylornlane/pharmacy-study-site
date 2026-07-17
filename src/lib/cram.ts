import type { Deck, FactSrsState } from "../types";
import { buildFactCards } from "./factCards";
import type { FactCard } from "./factCards";
import { getSrsState } from "./srs";
import type { StateGetter } from "./srs";

// A fact card tagged with which deck it came from, so review results can be
// written back to the right place even when studying across many sets at once.
export interface CramCard extends FactCard {
  deckId: string;
  deckName: string;
}

export function buildCramCards(decks: Deck[]): CramCard[] {
  const cards: CramCard[] = [];
  for (const deck of decks) {
    if (deck.kind !== "drugs") continue;
    for (const card of buildFactCards(deck.drugs)) {
      cards.push({ ...card, deckId: deck.id, deckName: deck.name });
    }
  }
  return cards;
}

/** Builds a StateGetter that looks up the right originating deck per card id. */
export function stateGetterForCram(decks: Deck[], cards: CramCard[]): StateGetter {
  const deckById = new Map(decks.map((d) => [d.id, d]));
  const deckIdByCardId = new Map(cards.map((c) => [c.id, c.deckId]));
  return (id: string): FactSrsState => {
    const deckId = deckIdByCardId.get(id);
    const deck = deckId ? deckById.get(deckId) : undefined;
    return deck ? getSrsState(deck, id) : { box: 1, dueAt: Date.now(), timesSeen: 0, timesCorrect: 0 };
  };
}

export function deckIdForCramCardId(cards: CramCard[], id: string): string | undefined {
  return cards.find((c) => c.id === id)?.deckId;
}
