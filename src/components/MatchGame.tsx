import { useEffect, useRef, useState } from "react";
import { awardReview, evaluateAchievements, recordHighScore, recordSessionComplete } from "../lib/gamification";
import type { Achievement } from "../lib/gamification";
import type { MatchPair } from "../lib/matchGame";
import { pickMatchRound, shuffle } from "../lib/matchGame";

interface Props {
  pairs: MatchPair[];
  onExit: () => void;
  roundSize?: number;
}

interface Tile {
  key: string;
  pairId: string;
  text: string;
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds - minutes * 60).toFixed(1);
  return minutes > 0 ? `${minutes}:${seconds.padStart(4, "0")}` : `${seconds}s`;
}

export default function MatchGame({ pairs, onExit, roundSize = 6 }: Props) {
  const [round, setRound] = useState<MatchPair[]>(() => pickMatchRound(pairs, roundSize));
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildTiles(source: MatchPair[]): Tile[] {
    const termTiles = source.map((p) => ({ key: `${p.id}::term`, pairId: p.id, text: p.term }));
    const defTiles = source.map((p) => ({ key: `${p.id}::def`, pairId: p.id, text: p.definition }));
    return shuffle([...termTiles, ...defTiles]);
  }

  useEffect(() => {
    setTiles(buildTiles(round));
    setSelected(null);
    setWrongKeys([]);
    setMatchedPairIds(new Set());
    setMistakes(0);
    setStartedAt(null);
    setElapsed(0);
    setFinished(false);
    setNewAchievements([]);
    setIsNewHighScore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (startedAt === null || finished) return;
    const interval = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [startedAt, finished]);

  useEffect(() => {
    return () => {
      if (wrongTimeoutRef.current) clearTimeout(wrongTimeoutRef.current);
    };
  }, []);

  function newRound() {
    setRound(pickMatchRound(pairs, roundSize));
  }

  function handleTileClick(tile: Tile) {
    if (finished || wrongKeys.length > 0 || matchedPairIds.has(tile.pairId)) return;
    if (startedAt === null) setStartedAt(Date.now());

    if (selected === null) {
      setSelected(tile.key);
      return;
    }
    if (selected === tile.key) {
      setSelected(null);
      return;
    }
    const selectedTile = tiles.find((t) => t.key === selected);
    if (!selectedTile) {
      setSelected(tile.key);
      return;
    }
    if (selectedTile.pairId === tile.pairId) {
      const nextMatched = new Set(matchedPairIds);
      nextMatched.add(tile.pairId);
      setMatchedPairIds(nextMatched);
      setSelected(null);
      awardReview("good");
      if (nextMatched.size === round.length) {
        const finishElapsed = startedAt !== null ? Date.now() - startedAt : elapsed;
        setElapsed(finishElapsed);
        setFinished(true);
        recordSessionComplete(round.length, Math.max(0, round.length - mistakes), "match");
        setIsNewHighScore(recordHighScore("match", finishElapsed, false));
        setNewAchievements(evaluateAchievements());
      }
    } else {
      setWrongKeys([selected, tile.key]);
      setMistakes((m) => m + 1);
      awardReview("again");
      wrongTimeoutRef.current = setTimeout(() => {
        setWrongKeys([]);
        setSelected(null);
      }, 500);
    }
  }

  function handleExit() {
    if (!finished && (matchedPairIds.size > 0 || mistakes > 0)) {
      recordSessionComplete(matchedPairIds.size + mistakes, matchedPairIds.size, "match");
    }
    onExit();
  }

  const displayElapsed = finished ? elapsed : startedAt !== null ? elapsed : 0;

  if (pairs.length < 2) {
    return (
      <div className="empty-state">
        <h3>Not enough cards to match</h3>
        <p>Add at least 2 cards to this set before playing Match.</p>
        <button className="btn" onClick={handleExit}>
          Back to set
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={handleExit}>
          ← Back to set
        </button>
        <span className="pill-meter-text" style={{ fontSize: 16, fontWeight: 600 }}>
          ⏱ {formatTime(displayElapsed)}
        </span>
      </div>

      {finished ? (
        <div className="empty-state">
          <h3>Matched all {round.length} pairs 🎉</h3>
          <p>Your time: {formatTime(elapsed)}</p>
          {isNewHighScore && <p style={{ color: "var(--sage-dark)", fontWeight: 600 }}>🏆 New best time!</p>}
          {newAchievements.length > 0 && (
            <div style={{ marginTop: 10, marginBottom: 4 }}>
              {newAchievements.map((a) => (
                <div key={a.id} className="pill-meter-text">
                  {a.icon} New achievement: <strong style={{ color: "var(--ink)" }}>{a.label}</strong>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={newRound}>
            Play again
          </button>
        </div>
      ) : (
        <div
          className="match-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {tiles.map((tile) => {
            const isMatched = matchedPairIds.has(tile.pairId);
            const isSelected = selected === tile.key;
            const isWrong = wrongKeys.includes(tile.key);
            if (isMatched) return null;
            return (
              <button
                key={tile.key}
                className={`choice-btn ${isWrong ? "incorrect" : isSelected ? "selected" : ""}`}
                style={{ minHeight: 70, fontSize: 13.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => handleTileClick(tile)}
              >
                {tile.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
