import { useState } from "react";
import type { CaseUnit } from "../lib/caseCards";
import { recordSessionComplete } from "../lib/gamification";
import { buildLearnQueue, deckMasteryPercent, isMasteredState } from "../lib/srs";
import type { StateGetter } from "../lib/srs";

interface Props {
  units: CaseUnit[]; // pool for this session (already filtered upstream)
  allUnits: CaseUnit[]; // full pool, for mastery %
  getState: StateGetter;
  onReview: (factId: string, result: "again" | "good") => void;
  onExit: () => void;
}

export default function CaseStudy({ units, allUnits, getState, onReview, onExit }: Props) {
  const [queue, setQueue] = useState<CaseUnit[]>(() => buildLearnQueue(units, getState));
  const [revealed, setRevealed] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [sessionSeen, setSessionSeen] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const mastery = deckMasteryPercent(allUnits, getState);
  const current = queue[0];
  const currentState = current ? getState(current.id) : null;

  function handleExit() {
    recordSessionComplete(sessionSeen, sessionCorrect, "cases");
    onExit();
  }

  if (!current) {
    return (
      <div className="empty-state">
        <h3>{allUnits.length === 0 ? "No cases yet" : "All caught up 🎉"}</h3>
        <p>
          {allUnits.length === 0
            ? "Add some patient cases to this set before practicing."
            : sessionSeen > 0
            ? `Nice work — you got ${sessionCorrect} of ${sessionSeen} right this session. Mastery is now ${mastery}%.`
            : "Nothing due for review in this filter right now."}
        </p>
        <button className="btn" onClick={handleExit}>
          Back to set
        </button>
      </div>
    );
  }

  function advance(result: "again" | "good") {
    onReview(current.id, result);
    setSessionSeen((s) => s + 1);
    setSessionCorrect((s) => s + (result === "good" ? 1 : 0));
    setQueue((prev) => {
      const rest = prev.slice(1);
      if (result === "again") {
        const pos = Math.min(rest.length, 3);
        const updated = { ...current };
        return [...rest.slice(0, pos), updated, ...rest.slice(pos)];
      }
      return rest;
    });
    setRevealed(false);
    setDraftAnswer("");
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={handleExit}>
          ← Back to set
        </button>
        <div className="pill-meter">
          <div className="pill-bottle">
            <div className="pill-bottle-fill" style={{ height: `${mastery}%` }} />
          </div>
          <span className="pill-meter-text">{mastery}% mastered</span>
        </div>
      </div>

      <div className="rx-card" style={{ cursor: "default", maxWidth: 640 }}>
        <div className="rx-card-label-top">Patient case</div>
        <div className="rx-card-body">
          <div className="rx-field">
            <div className="rx-field-label">Presentation</div>
            <div className="rx-field-value">{current.stem}</div>
          </div>
          <hr className="rx-card-perforation" />
          <div className="rx-field">
            <div className="rx-field-label">Question</div>
            <div className="rx-field-value" style={{ fontSize: 17 }}>{current.prompt}</div>
          </div>

          <textarea
            rows={3}
            placeholder="Jot down your answer (optional) before revealing..."
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            disabled={revealed}
            style={{ marginTop: 10 }}
          />

          {!revealed ? (
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setRevealed(true)}>
              Show answer
            </button>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="rx-field">
                <div className="rx-field-label">Model answer / rationale</div>
                <div className="rx-field-value">{current.answer}</div>
              </div>
              <div className="toolbar" style={{ marginBottom: 0, marginTop: 10 }}>
                <button className="btn" onClick={() => advance("again")}>
                  Needs more practice
                </button>
                <button className="btn btn-primary" onClick={() => advance("good")}>
                  I nailed it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", marginTop: 16 }}>
        {queue.length} question{queue.length === 1 ? "" : "s"} left this session
        {currentState && isMasteredState(currentState) ? " · mastered" : ""}
      </p>
    </div>
  );
}
