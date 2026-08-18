import { useEffect, useRef, useState } from "react";
import type { FactCard } from "../lib/factCards";
import { shuffle } from "../lib/matchGame";
import { STARTING_LIVES, durationForStreak, isCorrectAnswer, pointsForCorrectAnswer } from "../lib/typingAttack";
import { evaluateAchievements, recordHighScore, recordSessionComplete } from "../lib/gamification";
import type { Achievement } from "../lib/gamification";

interface Props {
  cards: FactCard[];
  onExit: () => void;
}

interface Stats {
  score: number;
  combo: number;
  correct: number;
  seen: number;
  lives: number;
}

const TICK_MS = 100;

function initialStats(): Stats {
  return { score: 0, combo: 0, correct: 0, seen: 0, lives: STARTING_LIVES };
}

export default function TypingAttack({ cards, onExit }: Props) {
  const poolRef = useRef<FactCard[]>(shuffle(cards));
  const poolIndexRef = useRef(0);
  const statsRef = useRef<Stats>(initialStats());
  const finalizedRef = useRef(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function drawCard(): FactCard | null {
    if (poolRef.current.length === 0) return null;
    if (poolIndexRef.current >= poolRef.current.length) {
      poolRef.current = shuffle(cards);
      poolIndexRef.current = 0;
    }
    const card = poolRef.current[poolIndexRef.current];
    poolIndexRef.current += 1;
    return card;
  }

  const [current, setCurrent] = useState<FactCard | null>(() => drawCard());
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<Stats>(statsRef.current);
  const [duration, setDuration] = useState(() => durationForStreak(0));
  const [timeLeft, setTimeLeft] = useState(() => durationForStreak(0));
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  function pushStats(patch: Partial<Stats>) {
    statsRef.current = { ...statsRef.current, ...patch };
    setStats(statsRef.current);
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, [current]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  // Ticks the countdown while a round is live.
  useEffect(() => {
    if (!current || feedback || gameOver) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - TICK_MS));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [current, feedback, gameOver]);

  // Reacts once the countdown actually hits zero.
  useEffect(() => {
    if (!current || feedback || gameOver) return;
    if (timeLeft <= 0) resolveRound(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  function finishGame() {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setGameOver(true);
    const s = statsRef.current;
    recordSessionComplete(s.seen, s.correct, "typing");
    setIsNewHighScore(recordHighScore("typing", s.score, true));
    setNewAchievements(evaluateAchievements());
  }

  function scheduleAdvance(delay: number) {
    advanceTimeoutRef.current = setTimeout(() => {
      const nextCard = drawCard();
      if (!nextCard) {
        finishGame();
        return;
      }
      setCurrent(nextCard);
      setInput("");
      setFeedback(null);
      const nextDuration = durationForStreak(statsRef.current.correct);
      setDuration(nextDuration);
      setTimeLeft(nextDuration);
    }, delay);
  }

  function resolveRound(correct: boolean) {
    if (!current || feedback || gameOver) return;
    const s = statsRef.current;
    if (correct) {
      const points = pointsForCorrectAnswer(timeLeft, duration, s.combo);
      pushStats({ score: s.score + points, combo: s.combo + 1, correct: s.correct + 1, seen: s.seen + 1 });
      setFeedback("correct");
      scheduleAdvance(650);
    } else {
      const newLives = s.lives - 1;
      pushStats({ combo: 0, lives: newLives, seen: s.seen + 1 });
      setFeedback("wrong");
      if (newLives <= 0) {
        advanceTimeoutRef.current = setTimeout(finishGame, 1300);
      } else {
        scheduleAdvance(1300);
      }
    }
  }

  function handleSubmit() {
    if (!current || feedback || gameOver || input.trim().length === 0) return;
    resolveRound(isCorrectAnswer(input, current.term));
  }

  function handleExit() {
    if (!gameOver && statsRef.current.seen > 0) {
      const s = statsRef.current;
      recordSessionComplete(s.seen, s.correct, "typing");
      recordHighScore("typing", s.score, true);
      evaluateAchievements();
    }
    onExit();
  }

  if (cards.length < 4) {
    return (
      <div className="empty-state">
        <h3>Not enough cards yet</h3>
        <p>Typing Attack needs at least 4 cards across your drug sets. Add some cards first.</p>
        <button className="btn" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  const timeFraction = duration > 0 ? timeLeft / duration : 0;
  const timerColor = timeFraction > 0.5 ? "var(--sage)" : timeFraction > 0.25 ? "var(--amber)" : "var(--brick)";

  if (gameOver) {
    return (
      <div className="empty-state">
        <h3>Game over 💥</h3>
        <p style={{ fontSize: 28, fontFamily: "var(--font-display)", margin: "10px 0" }}>{stats.score} pts</p>
        {isNewHighScore && <p style={{ color: "var(--sage-dark)", fontWeight: 600 }}>🏆 New high score!</p>}
        <p className="pill-meter-text">
          {stats.correct} correct / {stats.seen} seen this run
        </p>
        {newAchievements.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {newAchievements.map((a) => (
              <div key={a.id} className="pill-meter-text">
                {a.icon} New achievement: <strong style={{ color: "var(--ink)" }}>{a.label}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="toolbar" style={{ justifyContent: "center", marginTop: 18, marginBottom: 0 }}>
          <button className="btn btn-primary" onClick={onExit}>
            Back to sets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={handleExit}>
          ← Back to set
        </button>
        <div className="lives-row">
          {Array.from({ length: STARTING_LIVES }).map((_, i) => (
            <span key={i} className={`life-heart ${i < stats.lives ? "" : "lost"}`}>
              ♥
            </span>
          ))}
        </div>
      </div>

      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <span className="score-big">{stats.score} pts</span>
        {stats.combo >= 2 && <span className="combo-badge">🔥 x{stats.combo} combo</span>}
      </div>

      <div className="timer-track" style={{ marginBottom: 18 }}>
        <div
          className="timer-fill"
          style={{ width: `${Math.max(0, timeFraction) * 100}%`, background: timerColor }}
        />
      </div>

      {current && (
        <div className="rx-card" style={{ cursor: "default" }}>
          <div className="rx-card-label-top">Typing Attack · {current.fieldLabel}</div>
          <div className="rx-card-body">
            <p className="rx-field-value" style={{ fontSize: 18, marginBottom: 18 }}>
              {current.value}
            </p>
            <label>Type the drug name</label>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={feedback !== null}
              placeholder="Type here and press Enter..."
              autoComplete="off"
            />

            {feedback === "correct" && (
              <p style={{ marginTop: 12, fontWeight: 600, color: "var(--sage-dark)" }}>Correct! ⚡</p>
            )}
            {feedback === "wrong" && (
              <p style={{ marginTop: 12, fontWeight: 600, color: "var(--brick)" }}>
                {timeLeft <= 0 ? "Too slow" : "Not quite"} — it was <strong>{current.term}</strong>
              </p>
            )}

            {feedback === null && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                disabled={input.trim().length === 0}
                onClick={handleSubmit}
              >
                Submit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
