import { useEffect, useMemo, useState } from "react";
import type { Deck, DrugInteraction, DrugRecord, NewDrugInput } from "../types";
import {
  addDrugsToDeck,
  addInteraction,
  deleteDrug,
  deleteInteraction,
  setFactSrsState,
  updateDrug,
  updateInteraction,
} from "../lib/storage";
import { buildFactCards } from "../lib/factCards";
import { awardReview } from "../lib/gamification";
import { buildInteractionUnits } from "../lib/interactionCards";
import { deckMasteryPercent, getSrsState, reviewState, splitByMastery, stateGetterForDeck } from "../lib/srs";
import { listRecordingIds, playRecording } from "../lib/audioStore";
import { downloadBlob, exportDecks } from "../lib/exportImport";
import CardEditor from "./CardEditor";
import ImportFile from "./ImportFile";
import type { ImportResult } from "./ImportFile";
import ReviewImportedCards from "./ReviewImportedCards";
import Flashcards from "./Flashcards";
import InteractionEditor from "./InteractionEditor";
import InteractionQuiz from "./InteractionQuiz";
import Learn from "./Learn";
import MatchGame from "./MatchGame";
import type { MatchPair } from "../lib/matchGame";
import PronunciationRecorder from "./PronunciationRecorder";

interface Props {
  deck: Deck;
  onBack: () => void;
  onDeckChanged: () => void;
}

type Tab = "study" | "manage" | "interactions";
type StudyMode = "browse" | "flashcards" | "learn" | "match" | "interactions-quiz";
type Filter = "all" | "known" | "practice";

export default function DeckView({ deck, onBack, onDeckChanged }: Props) {
  const [tab, setTab] = useState<Tab>("study");
  const [studyMode, setStudyMode] = useState<StudyMode>("browse");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAddCard, setShowAddCard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportResult[] | null>(null);
  const [editingDrug, setEditingDrug] = useState<DrugRecord | null>(null);
  const [recordingDrug, setRecordingDrug] = useState<DrugRecord | null>(null);
  const [recordingIds, setRecordingIds] = useState<Set<string>>(new Set());
  const [exportingSet, setExportingSet] = useState(false);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<DrugInteraction | null>(null);

  function refreshRecordingIds() {
    listRecordingIds().then(setRecordingIds);
  }

  useEffect(() => {
    refreshRecordingIds();
  }, []);

  const allCards = useMemo(() => buildFactCards(deck.drugs), [deck.drugs]);
  const getState = useMemo(() => stateGetterForDeck(deck), [deck]);
  const { known, practice } = useMemo(() => splitByMastery(allCards, getState), [allCards, getState]);
  const mastery = deckMasteryPercent(allCards, getState);

  const filteredCards = filter === "known" ? known : filter === "practice" ? practice : allCards;

  const interactionUnits = useMemo(
    () => buildInteractionUnits(deck.interactions, deck.drugs),
    [deck.interactions, deck.drugs]
  );
  const interactionMastery = deckMasteryPercent(interactionUnits, getState);

  function handleAddCard(input: NewDrugInput) {
    addDrugsToDeck(deck.id, [input]);
    setShowAddCard(false);
    onDeckChanged();
  }

  function handleConfirmImport(groups: { name: string; drugs: NewDrugInput[] }[]) {
    const allDrugs = groups.flatMap((g) => g.drugs);
    addDrugsToDeck(deck.id, allDrugs);
    setPendingImport(null);
    onDeckChanged();
  }

  function handleReview(factId: string, result: "again" | "good") {
    const state = getSrsState(deck, factId);
    setFactSrsState(deck.id, factId, reviewState(state, result));
    awardReview(result);
    onDeckChanged();
  }

  function handleDeleteDrug(drugId: string) {
    if (confirm("Remove this card and all its facts?")) {
      deleteDrug(deck.id, drugId);
      onDeckChanged();
    }
  }

  function handleDeleteInteraction(interactionId: string) {
    if (confirm("Remove this interaction?")) {
      deleteInteraction(deck.id, interactionId);
      onDeckChanged();
    }
  }

  if (studyMode === "flashcards") {
    return <Flashcards cards={filteredCards} recordingIds={recordingIds} onExit={() => setStudyMode("browse")} />;
  }

  if (studyMode === "learn") {
    return (
      <Learn
        cards={filteredCards}
        allPoolCards={allCards}
        getState={getState}
        sessionMode="learn"
        recordingIds={recordingIds}
        onReview={handleReview}
        onExit={() => setStudyMode("browse")}
      />
    );
  }

  if (studyMode === "match") {
    const pairs: MatchPair[] = filteredCards.map((c) => ({
      id: c.id,
      term: `${c.term} — ${c.fieldLabel}`,
      definition: c.value,
    }));
    return <MatchGame pairs={pairs} onExit={() => setStudyMode("browse")} />;
  }

  if (studyMode === "interactions-quiz") {
    return (
      <InteractionQuiz
        units={interactionUnits}
        allUnits={interactionUnits}
        getState={getState}
        onReview={handleReview}
        onExit={() => setStudyMode("browse")}
      />
    );
  }

  return (
    <div>
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        ← All sets
      </button>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 4px" }}>
          {deck.name}
        </h2>
        <span className="pill-meter-text">
          {deck.drugs.length} drug{deck.drugs.length === 1 ? "" : "s"} · {allCards.length} card
          {allCards.length === 1 ? "" : "s"} · {mastery}% mastered
        </span>
      </div>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <button className={`btn ${tab === "study" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("study")}>
          Study
        </button>
        <button className={`btn ${tab === "manage" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("manage")}>
          Manage cards
        </button>
        <button
          className={`btn ${tab === "interactions" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("interactions")}
        >
          Interactions
        </button>
      </div>

      {tab === "study" && (
        <div>
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
              onClick={() => setStudyMode("learn")}
            >
              Learn
            </button>
            <button
              className="btn"
              disabled={filteredCards.length === 0}
              onClick={() => setStudyMode("flashcards")}
            >
              Flashcards
            </button>
            <button
              className="btn"
              disabled={filteredCards.length < 2}
              onClick={() => setStudyMode("match")}
            >
              Match
            </button>
          </div>

          {allCards.length === 0 ? (
            <div className="empty-state">
              <h3>No cards yet</h3>
              <p>Switch to "Manage cards" to import a PDF or add a card.</p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="empty-state">
              <h3>Nothing in this filter</h3>
              <p>Try a different filter, or come back after studying a bit.</p>
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Fact</th>
                  <th>Value</th>
                  <th>Box</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((c) => {
                  const state = getSrsState(deck, c.id);
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.term}</strong></td>
                      <td>{c.fieldLabel}</td>
                      <td>{c.value}</td>
                      <td><span className="tag">box {state.box}/5</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "manage" && (
        <div>
          <div className="toolbar">
            <button className="btn" onClick={() => setShowImport(true)}>
              Import PDF
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddCard(true)}>
              + Add card
            </button>
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-ghost"
              disabled={exportingSet}
              onClick={async () => {
                setExportingSet(true);
                try {
                  const blob = await exportDecks([deck]);
                  downloadBlob(blob, `${deck.name}.rxcards`);
                } finally {
                  setExportingSet(false);
                }
              }}
            >
              {exportingSet ? "Exporting..." : "⬇ Export this set"}
            </button>
          </div>

          {deck.drugs.length === 0 ? (
            <div className="empty-state">
              <h3>No cards yet</h3>
              <p>Import a drug table PDF, or add your first card manually.</p>
            </div>
          ) : (
            deck.drugs.map((drug) => (
              <div
                key={drug.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: 14,
                  marginBottom: 10,
                  background: "white",
                }}
              >
                <div className="toolbar" style={{ marginBottom: 8 }}>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{drug.term}</strong>
                  {recordingIds.has(drug.id) && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 15, padding: "2px 8px" }}
                      onClick={() => playRecording(drug.id)}
                      title="Hear pronunciation"
                    >
                      🔊
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-ghost" onClick={() => setRecordingDrug(drug)}>
                    {recordingIds.has(drug.id) ? "🎙 Re-record" : "🎙 Record"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditingDrug(drug)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-danger" onClick={() => handleDeleteDrug(drug.id)}>
                    Delete
                  </button>
                </div>
                {drug.fields.length === 0 ? (
                  <span className="pill-meter-text">No facts added</span>
                ) : (
                  drug.fields.map((f, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 3 }}>
                      <span style={{ color: "var(--sage-dark)", fontWeight: 600 }}>{f.label}:</span> {f.value}
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "interactions" && (
        <div>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <span className="pill-meter-text">
              {interactionUnits.length} interaction{interactionUnits.length === 1 ? "" : "s"} · {interactionMastery}% mastered
            </span>
          </div>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              disabled={interactionUnits.length === 0}
              onClick={() => setStudyMode("interactions-quiz")}
            >
              Quiz interactions
            </button>
            <button
              className="btn btn-ghost"
              disabled={deck.drugs.length < 2}
              onClick={() => setShowAddInteraction(true)}
            >
              + Add interaction
            </button>
          </div>

          {deck.drugs.length < 2 ? (
            <div className="empty-state">
              <h3>Add at least 2 drugs first</h3>
              <p>Interactions cross-reference two drugs already in this set — add cards under "Manage cards" first.</p>
            </div>
          ) : deck.interactions.length === 0 ? (
            <div className="empty-state">
              <h3>No interactions yet</h3>
              <p>Add a drug-drug interaction to quiz yourself on mechanisms, effects, and management.</p>
            </div>
          ) : (
            deck.interactions.map((ix) => {
              const drugA = deck.drugs.find((d) => d.id === ix.drugAId);
              const drugB = deck.drugs.find((d) => d.id === ix.drugBId);
              return (
                <div
                  key={ix.id}
                  style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 14, marginBottom: 10, background: "white" }}
                >
                  <div className="toolbar" style={{ marginBottom: 8 }}>
                    <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
                      {drugA?.term ?? "?"} + {drugB?.term ?? "?"}
                    </strong>
                    <span className="tag" style={{ textTransform: "capitalize" }}>{ix.severity}</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-ghost" onClick={() => setEditingInteraction(ix)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-danger" onClick={() => handleDeleteInteraction(ix.id)}>
                      Delete
                    </button>
                  </div>
                  <div style={{ fontSize: 13 }}>{ix.description}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showAddCard && <CardEditor onSave={handleAddCard} onClose={() => setShowAddCard(false)} />}

      {editingDrug && (
        <CardEditor
          initial={editingDrug}
          onSave={(input) => {
            updateDrug(deck.id, { ...editingDrug, ...input });
            setEditingDrug(null);
            onDeckChanged();
          }}
          onClose={() => setEditingDrug(null)}
        />
      )}

      {showImport && (
        <ImportFile
          onParsed={(results) => {
            setShowImport(false);
            setPendingImport(results);
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {pendingImport && (
        <ReviewImportedCards
          results={pendingImport}
          existingSetName={deck.name}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {recordingDrug && (
        <PronunciationRecorder
          drugId={recordingDrug.id}
          term={recordingDrug.term}
          onChanged={refreshRecordingIds}
          onClose={() => setRecordingDrug(null)}
        />
      )}

      {showAddInteraction && (
        <InteractionEditor
          drugs={deck.drugs}
          onSave={(input) => {
            addInteraction(deck.id, input);
            setShowAddInteraction(false);
            onDeckChanged();
          }}
          onClose={() => setShowAddInteraction(false)}
        />
      )}

      {editingInteraction && (
        <InteractionEditor
          drugs={deck.drugs}
          initial={editingInteraction}
          onSave={(input) => {
            updateInteraction(deck.id, { ...editingInteraction, ...input });
            setEditingInteraction(null);
            onDeckChanged();
          }}
          onClose={() => setEditingInteraction(null)}
        />
      )}
    </div>
  );
}
