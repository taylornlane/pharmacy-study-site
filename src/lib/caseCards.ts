import type { PatientCase } from "../types";
import { caseFactId } from "../types";

// The atomic study unit for a patient case: one question within one case,
// carrying its case's stem along so the study UI can show full context.
export interface CaseUnit {
  id: string; // `${caseId}::${questionId}`
  caseId: string;
  stem: string;
  questionId: string;
  prompt: string;
  answer: string;
}

export function buildCaseUnits(cases: PatientCase[]): CaseUnit[] {
  const units: CaseUnit[] = [];
  for (const c of cases) {
    for (const q of c.questions) {
      if (q.prompt.trim()) {
        units.push({
          id: caseFactId(c.id, q.id),
          caseId: c.id,
          stem: c.stem,
          questionId: q.id,
          prompt: q.prompt,
          answer: q.answer,
        });
      }
    }
  }
  return units;
}
