import { useEffect, useMemo, useState } from "react";
import type { FactCard } from "../lib/factCards";
import { recordSessionComplete } from "../lib/gamification";
import { buildLearnQueue, deckMasteryPercent, isMasteredState } from "../lib/srs";
import type { StateGetter } from "../lib/srs";
import { playRecording } from "../lib/audioStore";

interface Props {
  cards: FactCard[]; // the pool this session studies from (already filtered upstream)
  allPoolCards: FactCard[]; // full pool (deck, or all decks for cram), used for distractors + mastery %
  getState: StateGetter;
  recordingIds?: Set<string>;
  onReview: (factId: string, result: "again" | "good") => void;
  onExit: () => void;
  sessionMode?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Learn({ cards, allPoolCards, getState, recordingIds, onReview, onExit, sessionMode = "learn" }: Props) {
  const [queue, setQueue] = useState<FactCard[]>(() => buildLearnQueue(cards, getState));
  const [typedAnswer, setTypedAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [sessionSeen, setSessionSeen] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const mastery = deckMasteryPercent(allPoolCards, getState);
  const current = queue[0];
  const currentState = current ? getState(current.id) : null;

  const question = useMemo(() => {
    if (!current) return null;
    const mode: "choice" | "typed" = (currentState?.box ?? 1) <= 2 ? "choice" : "typed";
    if (mode === "choice") {
      const pool = allPoolCards.filter((c) => c.fieldKey === current.fieldKey && c.id !== current.id);
      const distractors = shuffle(pool).slice(0, 3).map((c) => c.value);
      const options = shuffle([current.value, ...distractors]);
      return { mode, options };
    }
    return { mode, options: [] as string[] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!question || question.mode !== "choice" || selectedChoice) return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0 && idx < question.options.length) {
        handleChoice(question.options[idx]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [question, selectedChoice, handleChoice]);

  function handleExit() {
    recordSessionComplete(sessionSeen, sessionCorrect, sessionMode);
    onExit();
  }

  if (!current || !question) {
    return (
      <div className="empty-state">
        <h3>{allPoolCards.length === 0 ? "No cards yet" : "All caught up 🎉"}</h3>
        <p>
          {allPoolCards.length === 0
            ? "Add some cards before learning."
            : sessionSeen > 0
            ? `Nice work — you got ${sessionCorrect} of ${sessionSeen} right this session. Mastery is now ${mastery}%.`
            : "Nothing due for review in this filter right now."}
        </p>
        <button className="btn" onClick={handleExit}>
          Back
        </button>
      </div>
    );
  }

  function advance(result: "again" | "good") {
    onReview(current.id, result);
    setSessionSeen((s) => s + 1);
    setSessionCorrect((s) => s + (result === "good" ? 1 : 0));

    const updated = { ...current };
    setQueue((prev) => {
      const rest = prev.slice(1);
      if (result === "again") {
        const pos = Math.min(rest.length, 3);
        return [...rest.slice(0, pos), updated, ...rest.slice(pos)];
      }
      return rest;
    });
    setTypedAnswer("");
    setRevealed(false);
    setSelectedChoice(null);
  }

  function handleChoice(choice: string) {
    if (selectedChoice) return;
    setSelectedChoice(choice);
    const correct = choice === current.value;
    setTimeout(() => advance(correct ? "good" : "again"), 700);
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

      <div className="rx-card" style={{ cursor: "default" }}>
        <div className="rx-card-label-top">
          Learn · {question.mode === "choice" ? "Multiple choice" : "Type the answer"}
        </div>
        <div className="rx-card-body">
          {question.mode === "choice" ? (
            <>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                Which one is the {current.fieldLabel.toLowerCase()} for:
              </p>
              <p className="rx-card-term" style={{ fontSize: 26, display: "flex", alignItems: "center", gap: 10 }}>
                {current.term}
                {recordingIds?.has(current.drugId) && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 16, padding: "2px 8px" }}
                    onClick={() => playRecording(current.drugId)}
                    title="Hear it said out loud"
                  >
                    🔊
                  </button>
                )}
              </p>
              <div className="choice-grid">
                {question.options.map((opt, i) => {
                  const isCorrect = opt === current.value;
                  const showState = selectedChoice !== null;
                  const cls = showState
                    ? isCorrect
                      ? "correct"
                      : opt === selectedChoice
                      ? "incorrect"
                      : ""
                    : "";
                  return (
                    <button
                      key={opt}
                      className={`choice-btn ${cls}`}
                      onClick={() => handleChoice(opt)}
                      disabled={selectedChoice !== null}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)", marginRight: 8 }}>
                        {i + 1}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                Name the drug with this {current.fieldLabel.toLowerCase()}:
              </p>
              <p className="rx-field-value" style={{ fontSize: 17, marginBottom: 18 }}>
                {current.value}
              </p>
              <input
                type="text"
                placeholder="Type the drug name..."
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !revealed && setRevealed(true)}
                disabled={revealed}
              />
              {revealed && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    Correct answer: <strong>{current.term}</strong>
                    {recordingIds?.has(current.drugId) && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 15, padding: "2px 8px" }}
                        onClick={() => playRecording(current.drugId)}
                        title="Hear it said out loud"
                      >
                        🔊
                      </button>
                    )}
                  </p>
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <button className="btn" onClick={() => advance("again")}>
                      I got it wrong
                    </button>
                    <button className="btn btn-primary" onClick={() => advance("good")}>
                      I got it right
                    </button>
                  </div>
                </div>
              )}
              {!revealed && (
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setRevealed(true)}>
                  Check answer
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", marginTop: 16 }}>
        {queue.length} card{queue.length === 1 ? "" : "s"} left this session
        {currentState && isMasteredState(currentState) ? " · mastered" : ""}
      </p>
    </div>
  );
}
