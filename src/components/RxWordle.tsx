import { useEffect, useMemo, useState } from "react";
import {
  MAX_GUESSES,
  addRxdleGuess,
  bestLetterStatuses,
  evaluateGuess,
  loadRxdleState,
  pickDailyWord,
} from "../lib/rxdle";
import type { LetterStatus, RxdleState } from "../lib/rxdle";
import { evaluateAchievements, recordSessionComplete } from "../lib/gamification";
import type { Achievement } from "../lib/gamification";

interface Props {
  onExit: () => void;
}

const KB_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RxWordle({ onExit }: Props) {
  const [today] = useState(todayStr);
  const answer = useMemo(() => pickDailyWord(today), [today]);
  const [rxdleState, setRxdleState] = useState<RxdleState>(() => loadRxdleState(today));
  const [currentGuess, setCurrentGuess] = useState("");
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [copied, setCopied] = useState(false);

  const done = rxdleState.solved || rxdleState.failed || rxdleState.guesses.length >= MAX_GUESSES;

  function handleSubmit() {
    if (done || currentGuess.length !== answer.length) return;
    const solved = currentGuess.toUpperCase() === answer;
    const guessesAfter = rxdleState.guesses.length + 1;
    const exhausted = !solved && guessesAfter >= MAX_GUESSES;
    const updated = addRxdleGuess(today, currentGuess, solved, exhausted);
    setRxdleState(updated);
    setCurrentGuess("");
    if (solved || exhausted) {
      recordSessionComplete(1, solved ? 1 : 0, "rxdle");
      setNewAchievements(evaluateAchievements());
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (done) return;
      if (e.key === "Enter") {
        handleSubmit();
        return;
      }
      if (e.key === "Backspace") {
        setCurrentGuess((g) => g.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        setCurrentGuess((g) => (g.length < answer.length ? (g + e.key).toUpperCase() : g));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, currentGuess, answer]);

  function handleKeyClick(key: string) {
    if (done) return;
    if (key === "ENTER") return handleSubmit();
    if (key === "BACK") return setCurrentGuess((g) => g.slice(0, -1));
    setCurrentGuess((g) => (g.length < answer.length ? g + key : g));
  }

  const keyStatuses = useMemo(() => bestLetterStatuses(rxdleState.guesses, answer), [rxdleState.guesses, answer]);

  function buildShareText(): string {
    const emoji: Record<LetterStatus, string> = { correct: "🟩", present: "🟨", absent: "⬜" };
    const lines = rxdleState.guesses.map((g) => evaluateGuess(g, answer).map((s) => emoji[s]).join(""));
    const scoreLine = rxdleState.solved ? `${rxdleState.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    return `RxCards Rxdle ${today}\n${scoreLine}\n\n${lines.join("\n")}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in this browser/context — nothing to fall back to
    }
  }

  const tileSize = Math.max(26, Math.min(46, Math.floor(440 / answer.length) - 6));
  const rows: { letters: string; submitted: boolean }[] = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (i < rxdleState.guesses.length) rows.push({ letters: rxdleState.guesses[i], submitted: true });
    else if (i === rxdleState.guesses.length) rows.push({ letters: currentGuess, submitted: false });
    else rows.push({ letters: "", submitted: false });
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={onExit} style={{ marginBottom: 16 }}>
        ← All sets
      </button>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 4px" }}>🟩 Rx Wordle</h2>
        <span className="pill-meter-text">
          One drug name a day. {rxdleState.streak > 0 && `Current streak: ${rxdleState.streak} day${rxdleState.streak === 1 ? "" : "s"}.`}
        </span>
      </div>

      <div className="wordle-grid" style={{ "--tile-size": `${tileSize}px` } as any}>
        {rows.map((row, ri) => {
          const statuses = row.submitted ? evaluateGuess(row.letters, answer) : null;
          return (
            <div className="wordle-row" key={ri}>
              {Array.from({ length: answer.length }).map((_, ci) => {
                const letter = row.letters[ci] ?? "";
                const status = statuses?.[ci];
                const cls = status ?? (letter ? "filled" : "empty");
                return (
                  <div key={ci} className={`wordle-tile ${cls}`}>
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {!done && (
        <p className="pill-meter-text" style={{ textAlign: "center", marginTop: 10 }}>
          Guess a {answer.length}-letter pharmacy drug name. Type or tap the keyboard below.
        </p>
      )}

      {done && (
        <div className="empty-state" style={{ marginTop: 18 }}>
          <h3>{rxdleState.solved ? "Solved it! 🎉" : `Today's word was ${answer}`}</h3>
          <p className="pill-meter-text">
            {rxdleState.solved
              ? `Got it in ${rxdleState.guesses.length}/${MAX_GUESSES}.`
              : "Better luck tomorrow."}{" "}
            Best streak: {rxdleState.bestStreak} day{rxdleState.bestStreak === 1 ? "" : "s"}. Come back tomorrow for a new word.
          </p>
          {newAchievements.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {newAchievements.map((a) => (
                <div key={a.id} className="pill-meter-text">
                  {a.icon} New achievement: <strong style={{ color: "var(--ink)" }}>{a.label}</strong>
                </div>
              ))}
            </div>
          )}
          <button className="btn" style={{ marginTop: 14 }} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy result"}
          </button>
        </div>
      )}

      {!done && (
        <div className="wordle-keyboard">
          {KB_ROWS.map((row, ri) => (
            <div className="wordle-kb-row" key={ri}>
              {ri === 2 && (
                <button className="wordle-key wide" onClick={() => handleKeyClick("ENTER")}>
                  Enter
                </button>
              )}
              {row.split("").map((letter) => (
                <button
                  key={letter}
                  className={`wordle-key ${keyStatuses[letter] ?? ""}`}
                  onClick={() => handleKeyClick(letter)}
                >
                  {letter}
                </button>
              ))}
              {ri === 2 && (
                <button className="wordle-key wide" onClick={() => handleKeyClick("BACK")}>
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
