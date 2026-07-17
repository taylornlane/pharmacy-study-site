import { useEffect, useState } from "react";
import type { FactCard } from "../lib/factCards";
import { playRecording } from "../lib/audioStore";

interface Props {
  cards: FactCard[];
  recordingIds?: Set<string>;
  onExit: () => void;
}

export default function Flashcards({ cards, recordingIds, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (cards.length === 0) {
    return (
      <div className="empty-state">
        <h3>Nothing to study here</h3>
        <p>No cards match this filter yet.</p>
        <button className="btn" onClick={onExit}>
          Back to set
        </button>
      </div>
    );
  }

  const card = cards[index];

  function next() {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  }

  function prev() {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={onExit}>
          ← Back to set
        </button>
        <span className="pill-meter-text">
          Card {index + 1} of {cards.length}
        </span>
      </div>

      <div className="rx-card" onClick={() => setFlipped((f) => !f)}>
        <div className="rx-card-label-top">Rx · {flipped ? card.fieldLabel : "Drug name"}</div>
        <div className="rx-card-body">
          {!flipped ? (
            <>
              <p className="rx-card-term" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {card.term}
                {recordingIds?.has(card.drugId) && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 18, padding: "2px 8px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      playRecording(card.drugId);
                    }}
                    title="Hear it said out loud"
                  >
                    🔊
                  </button>
                )}
              </p>
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                Tap the card to reveal its {card.fieldLabel.toLowerCase()}.
              </p>
            </>
          ) : (
            <>
              <p className="rx-card-term" style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 10 }}>
                {card.term}
                {recordingIds?.has(card.drugId) && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 16, padding: "2px 8px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      playRecording(card.drugId);
                    }}
                    title="Hear it said out loud"
                  >
                    🔊
                  </button>
                )}
              </p>
              <hr className="rx-card-perforation" />
              <div className="rx-field">
                <div className="rx-field-label">{card.fieldLabel}</div>
                <div className="rx-field-value">{card.value}</div>
              </div>
            </>
          )}
        </div>
        <div className="rx-card-hint">Click or press space to flip</div>
      </div>

      <div className="toolbar" style={{ justifyContent: "center", marginTop: 20 }}>
        <button className="btn" onClick={prev}>
          ← Prev
        </button>
        <button className="btn btn-primary" onClick={next}>
          Next →
        </button>
      </div>
    </div>
  );
}
