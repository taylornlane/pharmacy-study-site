import { useState } from "react";
import { awardReview, recordSessionComplete } from "../lib/gamification";
import type { PKProblem, PKProblemKind } from "../lib/pkCalc";
import { PK_KIND_LABELS, checkPKAnswer, generatePKProblem } from "../lib/pkCalc";

interface Props {
  onExit: () => void;
}

const ALL_KINDS = Object.keys(PK_KIND_LABELS) as PKProblemKind[];

export default function PKPractice({ onExit }: Props) {
  const [activeKind, setActiveKind] = useState<PKProblemKind>(ALL_KINDS[0]);
  const [problem, setProblem] = useState<PKProblem>(() => generatePKProblem([ALL_KINDS[0]]));
  const [answerText, setAnswerText] = useState("");
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [sessionSeen, setSessionSeen] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  function selectKind(kind: PKProblemKind) {
    if (kind === activeKind) return;
    setActiveKind(kind);
    nextProblem([kind]);
  }

  function nextProblem(kinds: PKProblemKind[] = [activeKind]) {
    setProblem(generatePKProblem(kinds));
    setAnswerText("");
    setChecked(false);
    setWasCorrect(false);
  }

  function handleCheck() {
    const parsed = parseFloat(answerText);
    const correct = checkPKAnswer(problem, parsed);
    setWasCorrect(correct);
    setChecked(true);
    setSessionSeen((s) => s + 1);
    setSessionCorrect((s) => s + (correct ? 1 : 0));
    awardReview(correct ? "good" : "again");
  }

  function handleExit() {
    recordSessionComplete(sessionSeen, sessionCorrect, "pk");
    onExit();
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={handleExit}>
          ← All sets
        </button>
        {sessionSeen > 0 && (
          <span className="pill-meter-text">
            {sessionCorrect} / {sessionSeen} correct this session
          </span>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 4px" }}>
          PK Calculation Practice
        </h2>
        <span className="pill-meter-text">
          Half-life, clearance, Vd, loading &amp; maintenance dose — worked from the numbers you're given.
        </span>
      </div>

      <div className="toolbar">
        {ALL_KINDS.map((kind) => (
          <button
            key={kind}
            className={`btn ${activeKind === kind ? "btn-primary" : ""}`}
            onClick={() => selectKind(kind)}
          >
            {PK_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="rx-card" style={{ cursor: "default" }}>
        <div className="rx-card-label-top">PK · {PK_KIND_LABELS[problem.kind]}</div>
        <div className="rx-card-body">
          <p style={{ fontSize: 15, lineHeight: 1.5 }}>{problem.prompt}</p>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "14px 0" }}>
            {problem.givens.map((g) => (
              <div key={g.label} className="rx-field" style={{ marginBottom: 0 }}>
                <div className="rx-field-label">{g.label}</div>
                <div className="rx-field-value">{g.value}</div>
              </div>
            ))}
          </div>

          <hr className="rx-card-perforation" />

          <label>Your answer ({problem.unit})</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="number"
              inputMode="decimal"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !checked && handleCheck()}
              placeholder={`e.g. 12.5`}
              disabled={checked}
              autoFocus
              style={{ maxWidth: 200 }}
            />
            <span className="pill-meter-text">{problem.unit}</span>
          </div>

          {!checked ? (
            <button
              className="btn btn-primary"
              style={{ marginTop: 14 }}
              disabled={answerText.trim().length === 0}
              onClick={handleCheck}
            >
              Check answer
            </button>
          ) : (
            <div style={{ marginTop: 16 }}>
              <p
                style={{
                  fontWeight: 600,
                  color: wasCorrect ? "var(--sage-dark)" : "var(--brick)",
                  marginBottom: 6,
                }}
              >
                {wasCorrect ? "Correct" : "Not quite"} — answer is {problem.answer} {problem.unit}
              </p>
              <p className="pill-meter-text" style={{ fontFamily: "var(--font-mono)" }}>
                {problem.formula}
              </p>
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => nextProblem()}>
                Next problem →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
