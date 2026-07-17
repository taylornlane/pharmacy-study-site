import type { DrugRecord, FieldEntry } from "../types";
import { factId } from "../types";

// The atomic study unit: one drug paired with one fact about it.
// A drug with 4 filled-in fields becomes 4 separate FactCards.
export interface FactCard {
  id: string; // `${drugId}::${fieldKey}`
  drugId: string;
  term: string;
  fieldKey: string;
  fieldLabel: string;
  value: string;
}

export function buildFactCards(drugs: DrugRecord[]): FactCard[] {
  const cards: FactCard[] = [];
  for (const drug of drugs) {
    for (const f of drug.fields as FieldEntry[]) {
      if (f.value && f.value.trim().length > 0) {
        cards.push({
          id: factId(drug.id, f.key),
          drugId: drug.id,
          term: drug.term,
          fieldKey: f.key,
          fieldLabel: f.label,
          value: f.value,
        });
      }
    }
  }
  return cards;
}
