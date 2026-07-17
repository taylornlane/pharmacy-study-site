import { useState } from "react";
import type { InteractionUnit } from "../lib/interactionCards";
import { recordSessionComplete } from "../lib/gamification";
import { buildLearnQueue, deckMasteryPercent, isMasteredState } from "../lib/srs";
import type { StateGetter } from "../lib/srs";

interface Props {
  units: InteractionUnit[]; // pool for this session (already filtered upstream)
  allUnits: InteractionUnit[]; // full pool, for mastery %
  getState: StateGetter;
  onReview: (factId: string, result: "again" | "good") => void;
  onExit: () => void;
}

const SEVERITY_COLOR: Record<InteractionUnit["severity"], string> = {
  minor: "var(--sage-dark)",
  moderate: "var(--amber)",
  major: "var(--brick)",
};

export default function InteractionQuiz({ units, allUnits, getState, onReview, onExit }: Props) {
  const [queue, setQueue] = useState<InteractionUnit[]>(() => buildLearnQueue(units, getState));
  const [revealed, setRevealed] = useState(false);
  const [sessionSeen, setSessionSeen] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const mastery = deckMasteryPercent(allUnits, getState);
  const current = queue[0];
  const currentState = current ? getState(current.id) : null;

  function handleExit() {
    recordSessionComplete(sessionSeen, sessionCorrect, "interactions");
    onExit();
  }

  if (!current) {
    return (
      <div className="empty-state">
        <h3>{allUnits.length === 0 ? "No interactions yet" : "All caught up 🎉"}</h3>
        <p>
          {allUnits.length === 0
            ? "Add some drug-drug interactions to this set before quizzing."
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
        <div className="rx-card-label-top">Drug-drug interaction</div>
        <div className="rx-card-body">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase" }}>
            What's the interaction between:
          </p>
          <p className="rx-card-term" style={{ fontSize: 24 }}>
            {current.drugAName} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>+</span> {current.drugBName}
          </p>

          {!revealed ? (
            <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={() => setRevealed(true)}>
              Show interaction
            </button>
          ) : (
            <div style={{ marginTop: 14 }}>
              <hr className="rx-card-perforation" />
              <div className="rx-field">
                <div className="rx-field-label">
                  Severity ·{" "}
                  <span style={{ color: SEVERITY_COLOR[current.severity], textTransform: "capitalize" }}>
                    {current.severity}
                  </span>
                </div>
                <div className="rx-field-value">{current.description}</div>
              </div>
              <div className="toolbar" style={{ marginBottom: 0, marginTop: 10 }}>
                <button className="btn" onClick={() => advance("again")}>
                  Needs more practice
                </button>
                <button className="btn btn-primary" onClick={() => advance("good")}>
                  I knew it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", marginTop: 16 }}>
        {queue.length} interaction{queue.length === 1 ? "" : "s"} left this session
        {currentState && isMasteredState(currentState) ? " · mastered" : ""}
      </p>
    </div>
  );
}
