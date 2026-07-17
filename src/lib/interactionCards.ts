import type { DrugInteraction, DrugRecord } from "../types";
import { interactionFactId } from "../types";

// The atomic study unit for a drug-drug interaction: the two drug names
// plus the interaction's severity/description, keyed for SRS tracking.
export interface InteractionUnit {
  id: string; // `ix::${interactionId}`
  interactionId: string;
  drugAName: string;
  drugBName: string;
  severity: DrugInteraction["severity"];
  description: string;
}

export function buildInteractionUnits(interactions: DrugInteraction[], drugs: DrugRecord[]): InteractionUnit[] {
  const nameById = new Map(drugs.map((d) => [d.id, d.term]));
  const units: InteractionUnit[] = [];
  for (const ix of interactions) {
    const drugAName = nameById.get(ix.drugAId);
    const drugBName = nameById.get(ix.drugBId);
    if (!drugAName || !drugBName) continue; // stale reference to a deleted drug
    units.push({
      id: interactionFactId(ix.id),
      interactionId: ix.id,
      drugAName,
      drugBName,
      severity: ix.severity,
      description: ix.description,
    });
  }
  return units;
}
