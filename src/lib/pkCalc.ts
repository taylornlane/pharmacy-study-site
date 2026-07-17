import { uid } from "./uid";

// Basic one-compartment PK relationships used across PharmSci 608-style problems:
//   t½ = 0.693 × Vd / CL
//   CL = 0.693 × Vd / t½
//   Vd = CL × t½ / 0.693
//   Loading dose = (Cp target × Vd) / F
//   Maintenance dose (per interval τ) = (Css avg × CL × τ) / F

export type PKProblemKind = "half-life" | "clearance" | "vd" | "loading-dose" | "maintenance-dose";

export const PK_KIND_LABELS: Record<PKProblemKind, string> = {
  "half-life": "Half-life",
  clearance: "Clearance",
  vd: "Volume of distribution",
  "loading-dose": "Loading dose",
  "maintenance-dose": "Maintenance dose",
};

export interface PKProblem {
  id: string;
  kind: PKProblemKind;
  prompt: string;
  givens: { label: string; value: string }[];
  answer: number;
  unit: string;
  formula: string;
}

function randInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function genHalfLife(): PKProblem {
  const vd = randInt(20, 90);
  const cl = randInt(3, 18);
  const answer = round((0.693 * vd) / cl, 2);
  return {
    id: uid(),
    kind: "half-life",
    prompt: "A drug has the volume of distribution and clearance below. What is its half-life?",
    givens: [
      { label: "Vd", value: `${vd} L` },
      { label: "CL", value: `${cl} L/hr` },
    ],
    answer,
    unit: "hr",
    formula: "t½ = 0.693 × Vd / CL",
  };
}

function genClearance(): PKProblem {
  const vd = randInt(20, 90);
  const halfLife = randInt(2, 24);
  const answer = round((0.693 * vd) / halfLife, 2);
  return {
    id: uid(),
    kind: "clearance",
    prompt: "A drug has the volume of distribution and half-life below. What is its clearance?",
    givens: [
      { label: "Vd", value: `${vd} L` },
      { label: "t½", value: `${halfLife} hr` },
    ],
    answer,
    unit: "L/hr",
    formula: "CL = 0.693 × Vd / t½",
  };
}

function genVd(): PKProblem {
  const cl = randInt(3, 18);
  const halfLife = randInt(2, 24);
  const answer = round((cl * halfLife) / 0.693, 2);
  return {
    id: uid(),
    kind: "vd",
    prompt: "A drug has the clearance and half-life below. What is its volume of distribution?",
    givens: [
      { label: "CL", value: `${cl} L/hr` },
      { label: "t½", value: `${halfLife} hr` },
    ],
    answer,
    unit: "L",
    formula: "Vd = CL × t½ / 0.693",
  };
}

function genLoadingDose(): PKProblem {
  const cpTarget = randInt(5, 40);
  const vd = randInt(20, 90);
  const f = randFrom([1, 1, 1, 0.9, 0.8, 0.7, 0.5]);
  const answer = round((cpTarget * vd) / f, 1);
  return {
    id: uid(),
    kind: "loading-dose",
    prompt: `What loading dose is needed to reach the target plasma concentration below${f < 1 ? ", given the drug's oral bioavailability" : ""}?`,
    givens: [
      { label: "Target Cp", value: `${cpTarget} mg/L` },
      { label: "Vd", value: `${vd} L` },
      { label: "F", value: `${f}` },
    ],
    answer,
    unit: "mg",
    formula: "Loading dose = (Cp target × Vd) / F",
  };
}

function genMaintenanceDose(): PKProblem {
  const cssAvg = randInt(5, 40);
  const cl = randInt(3, 18);
  const tau = randFrom([6, 8, 12, 24]);
  const f = randFrom([1, 1, 1, 0.9, 0.8, 0.7, 0.5]);
  const answer = round((cssAvg * cl * tau) / f, 1);
  return {
    id: uid(),
    kind: "maintenance-dose",
    prompt: `What maintenance dose, given every ${tau} hours, will maintain the average steady-state concentration below${f < 1 ? ", given the drug's oral bioavailability" : ""}?`,
    givens: [
      { label: "Css avg", value: `${cssAvg} mg/L` },
      { label: "CL", value: `${cl} L/hr` },
      { label: "τ (interval)", value: `${tau} hr` },
      { label: "F", value: `${f}` },
    ],
    answer,
    unit: "mg per dose",
    formula: "Maintenance dose = (Css avg × CL × τ) / F",
  };
}

const GENERATORS: Record<PKProblemKind, () => PKProblem> = {
  "half-life": genHalfLife,
  clearance: genClearance,
  vd: genVd,
  "loading-dose": genLoadingDose,
  "maintenance-dose": genMaintenanceDose,
};

export function generatePKProblem(kinds: PKProblemKind[]): PKProblem {
  const pool = kinds.length > 0 ? kinds : (Object.keys(GENERATORS) as PKProblemKind[]);
  const kind = randFrom(pool);
  return GENERATORS[kind]();
}

// Accepts answers within 5% relative tolerance (or 0.05 absolute for very small answers)
// to allow for reasonable rounding during manual calculation.
export function checkPKAnswer(problem: PKProblem, userAnswer: number): boolean {
  if (!Number.isFinite(userAnswer)) return false;
  const tolerance = Math.max(Math.abs(problem.answer) * 0.05, 0.05);
  return Math.abs(userAnswer - problem.answer) <= tolerance;
}
