import { useMemo } from "react";
import { allAchievementsStatus, loadGamification } from "../lib/gamification";

interface Props {
  onExit: () => void;
}

const MODE_LABELS: Record<string, string> = {
  learn: "Learn",
  cram: "Cram session",
  cases: "Case practice",
  interactions: "Interactions quiz",
  pk: "PK practice",
  match: "Match",
  typing: "Typing Attack",
  rxdle: "Rx Wordle",
};

function formatMatchTime(ms: number): string {
  const seconds = ms / 1000;
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}` : `${seconds.toFixed(1)}s`;
}

export default function StatsView({ onExit }: Props) {
  const state = useMemo(() => loadGamification(), []);
  const achievementStatuses = useMemo(() => allAchievementsStatus(), []);
  const recent = state.sessions.slice(0, 15);
  const bestSession = state.sessions.reduce((best, s) => (s.points > (best?.points ?? -1) ? s : best), state.sessions[0]);
  const unlockedCount = achievementStatuses.filter((a) => a.unlockedAt !== null).length;

  return (
    <div>
      <button className="btn btn-ghost" onClick={onExit} style={{ marginBottom: 16 }}>
        ← All sets
      </button>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 4px" }}>
          🏆 Your Stats
        </h2>
        <span className="pill-meter-text">Points and streaks are tracked on this device only.</span>
      </div>

      <div className="deck-grid" style={{ marginBottom: 24 }}>
        <div className="deck-tile" style={{ cursor: "default" }}>
          <h3>{state.totalPoints}</h3>
          <div className="meta">Total points</div>
        </div>
        <div className="deck-tile" style={{ cursor: "default" }}>
          <h3>
            {state.currentStreakDays} day{state.currentStreakDays === 1 ? "" : "s"}
          </h3>
          <div className="meta">Current streak</div>
        </div>
        <div className="deck-tile" style={{ cursor: "default" }}>
          <h3>
            {state.bestStreakDays} day{state.bestStreakDays === 1 ? "" : "s"}
          </h3>
          <div className="meta">Best streak</div>
        </div>
        {bestSession && (
          <div className="deck-tile" style={{ cursor: "default" }}>
            <h3>{bestSession.points} pts</h3>
            <div className="meta">Best single session</div>
          </div>
        )}
      </div>

      {(state.highScores.typing !== undefined || state.highScores.match !== undefined) && (
        <>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 10 }}>Leaderboard</h3>
          <div className="deck-grid" style={{ marginBottom: 24 }}>
            {state.highScores.typing !== undefined && (
              <div className="deck-tile" style={{ cursor: "default" }}>
                <h3>{state.highScores.typing} pts</h3>
                <div className="meta">⌨️ Typing Attack best</div>
              </div>
            )}
            {state.highScores.match !== undefined && (
              <div className="deck-tile" style={{ cursor: "default" }}>
                <h3>{formatMatchTime(state.highScores.match)}</h3>
                <div className="meta">🃏 Match fastest time</div>
              </div>
            )}
          </div>
        </>
      )}

      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 10 }}>
        Achievements ({unlockedCount}/{achievementStatuses.length})
      </h3>
      <div className="badge-grid" style={{ marginBottom: 24 }}>
        {achievementStatuses.map(({ achievement, unlockedAt }) => (
          <div key={achievement.id} className={`badge-tile ${unlockedAt ? "" : "locked"}`}>
            <span className="badge-icon">{achievement.icon}</span>
            <div>
              <div className="badge-label">{achievement.label}</div>
              <div className="badge-desc">{achievement.description}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 10 }}>Recent sessions</h3>
      {recent.length === 0 ? (
        <div className="empty-state">
          <h3>No sessions yet</h3>
          <p>Study a set, play Match or Typing Attack, or solve today's Rx Wordle to start racking up points.</p>
        </div>
      ) : (
        <table className="card-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Score</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s, i) => (
              <tr key={i}>
                <td>{s.date}</td>
                <td>{MODE_LABELS[s.mode] ?? s.mode}</td>
                <td>
                  {s.correct}/{s.seen}
                </td>
                <td>
                  <span className="tag">+{s.points}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
