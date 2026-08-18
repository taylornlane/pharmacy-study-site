import { useEffect, useMemo, useState } from "react";
import type { Deck } from "../types";
import { buildCramCards, stateGetterForCram, deckIdForCramCardId } from "../lib/cram";
import { awardReview } from "../lib/gamification";
import { deckMasteryPercent, getSrsState, reviewState, splitByMastery } from "../lib/srs";
import { setFactSrsState } from "../lib/storage";
import { listRecordingIds } from "../lib/audioStore";
import Flashcards from "./Flashcards";
import Learn from "./Learn";
import MatchGame from "./MatchGame";
import type { MatchPair } from "../lib/matchGame";
import TypingAttack from "./TypingAttack";

interface Props {
  decks: Deck[]; // all decks in the app; only drug-kind ones with cards are used
  onExit: () => void;
  onChanged: () => void;
}

type Mode = "browse" | "flashcards" | "learn" | "match" | "typing";
type Filter = "all" | "known" | "practice";

export default function CramStudy({ decks, onExit, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>("browse");
  const [filter, setFilter] = useState<Filter>("practice");
  const [recordingIds, setRecordingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    listRecordingIds().then(setRecordingIds);
  }, []);

  const eligibleDecks = useMemo(
    () => decks.filter((d) => d.kind === "drugs" && d.drugs.length > 0),
    [decks]
  );
  const allCards = useMemo(() => buildCramCards(eligibleDecks), [eligibleDecks]);
  const getState = useMemo(() => stateGetterForCram(eligibleDecks, allCards), [eligibleDecks, allCards]);
  const { known, practice } = useMemo(() => splitByMastery(allCards, getState), [allCards, getState]);
  const mastery = deckMasteryPercent(allCards, getState);

  const filteredCards = filter === "known" ? known : filter === "practice" ? practice : allCards;

  function handleReview(factId: string, result: "again" | "good") {
    const deckId = deckIdForCramCardId(allCards, factId);
    if (!deckId) return;
    const deck = eligibleDecks.find((d) => d.id === deckId);
    if (!deck) return;
    const state = getSrsState(deck, factId);
    setFactSrsState(deckId, factId, reviewState(state, result));
    awardReview(result);
    onChanged();
  }

  if (mode === "flashcards") {
    return <Flashcards cards={filteredCards} recordingIds={recordingIds} onExit={() => setMode("browse")} />;
  }

  if (mode === "learn") {
    return (
      <Learn
        cards={filteredCards}
        allPoolCards={allCards}
        getState={getState}
        sessionMode="cram"
        recordingIds={recordingIds}
        onReview={handleReview}
        onExit={() => setMode("browse")}
      />
    );
  }

  if (mode === "match") {
    const pairs: MatchPair[] = filteredCards.map((c) => ({
      id: c.id,
      term: `${c.term} — ${c.fieldLabel}`,
      definition: c.value,
    }));
    return <MatchGame pairs={pairs} onExit={() => setMode("browse")} />;
  }

  if (mode === "typing") {
    return <TypingAttack cards={filteredCards} onExit={() => setMode("browse")} />;
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={onExit} style={{ marginBottom: 16 }}>
        ← All sets
      </button>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 4px" }}>
          Cram — all sets
        </h2>
        <span className="pill-meter-text">
          {eligibleDecks.length} set{eligibleDecks.length === 1 ? "" : "s"} pooled · {allCards.length} card
          {allCards.length === 1 ? "" : "s"} · {mastery}% mastered
        </span>
      </div>

      {eligibleDecks.length === 0 ? (
        <div className="empty-state">
          <h3>No drug sets to cram yet</h3>
          <p>Cram mode pools cards across your drug sets (patient case sets aren't included yet). Add some cards first.</p>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <button className={`btn ${filter === "all" ? "btn-primary" : ""}`} onClick={() => setFilter("all")}>
              All ({allCards.length})
            </button>
            <button className={`btn ${filter === "practice" ? "btn-primary" : ""}`} onClick={() => setFilter("practice")}>
              Needs practice ({practice.length})
            </button>
            <button className={`btn ${filter === "known" ? "btn-primary" : ""}`} onClick={() => setFilter("known")}>
              Known ({known.length})
            </button>
          </div>

          <div className="toolbar">
            <button
              className="btn btn-primary"
              disabled={filteredCards.length === 0}
              onClick={() => setMode("learn")}
            >
              Learn
            </button>
            <button
              className="btn"
              disabled={filteredCards.length === 0}
              onClick={() => setMode("flashcards")}
            >
              Flashcards
            </button>
            <button
              className="btn"
              disabled={filteredCards.length < 2}
              onClick={() => setMode("match")}
            >
              Match
            </button>
            <button
              className="btn"
              disabled={filteredCards.length < 4}
              onClick={() => setMode("typing")}
            >
              ⌨️ Typing Attack
            </button>
          </div>

          {filteredCards.length === 0 ? (
            <div className="empty-state">
              <h3>Nothing in this filter</h3>
              <p>Try a different filter.</p>
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Drug</th>
                  <th>Fact</th>
                  <th>Box</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.slice(0, 200).map((c) => {
                  const state = getState(c.id);
                  return (
                    <tr key={c.id}>
                      <td><span className="tag">{c.deckName}</span></td>
                      <td><strong>{c.term}</strong></td>
                      <td>{c.fieldLabel}: {c.value}</td>
                      <td><span className="tag">box {state.box}/5</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
