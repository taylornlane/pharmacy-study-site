import { useMemo, useState } from "react";
import type { Deck, PatientCase, NewCaseInput } from "../types";
import { addCasesToDeck, deleteCase, setFactSrsState, updateCase } from "../lib/storage";
import { buildCaseUnits } from "../lib/caseCards";
import { awardReview } from "../lib/gamification";
import { deckMasteryPercent, getSrsState, reviewState, splitByMastery, stateGetterForDeck } from "../lib/srs";
import CaseEditor from "./CaseEditor";
import CaseStudy from "./CaseStudy";
import MatchGame from "./MatchGame";
import type { MatchPair } from "../lib/matchGame";

interface Props {
  deck: Deck;
  onBack: () => void;
  onDeckChanged: () => void;
}

type Tab = "study" | "manage";
type StudyMode = "browse" | "practice" | "match";
type Filter = "all" | "known" | "practice";

export default function CaseDeckView({ deck, onBack, onDeckChanged }: Props) {
  const [tab, setTab] = useState<Tab>("study");
  const [studyMode, setStudyMode] = useState<StudyMode>("browse");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAddCase, setShowAddCase] = useState(false);
  const [editingCase, setEditingCase] = useState<PatientCase | null>(null);

  const allUnits = useMemo(() => buildCaseUnits(deck.cases), [deck.cases]);
  const getState = useMemo(() => stateGetterForDeck(deck), [deck]);
  const { known, practice } = useMemo(() => splitByMastery(allUnits, getState), [allUnits, getState]);
  const mastery = deckMasteryPercent(allUnits, getState);
  const filteredUnits = filter === "known" ? known : filter === "practice" ? practice : allUnits;

  function handleAddCase(input: NewCaseInput) {
    addCasesToDeck(deck.id, [input]);
    setShowAddCase(false);
    onDeckChanged();
  }

  function handleReview(factId: string, result: "again" | "good") {
    const state = getSrsState(deck, factId);
    setFactSrsState(deck.id, factId, reviewState(state, result));
    awardReview(result);
    onDeckChanged();
  }

  function handleDeleteCase(caseId: string) {
    if (confirm("Remove this case and all its questions?")) {
      deleteCase(deck.id, caseId);
      onDeckChanged();
    }
  }

  if (studyMode === "practice") {
    return (
      <CaseStudy
        units={filteredUnits}
        allUnits={allUnits}
        getState={getState}
        onReview={handleReview}
        onExit={() => setStudyMode("browse")}
      />
    );
  }

  if (studyMode === "match") {
    const pairs: MatchPair[] = filteredUnits.map((u) => ({
      id: u.id,
      term: u.prompt,
      definition: u.answer,
    }));
    return <MatchGame pairs={pairs} onExit={() => setStudyMode("browse")} />;
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
          {deck.cases.length} case{deck.cases.length === 1 ? "" : "s"} · {allUnits.length} question
          {allUnits.length === 1 ? "" : "s"} · {mastery}% mastered
        </span>
      </div>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <button className={`btn ${tab === "study" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("study")}>
          Study
        </button>
        <button className={`btn ${tab === "manage" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("manage")}>
          Manage cases
        </button>
      </div>

      {tab === "study" && (
        <div>
          <div className="toolbar">
            <button className={`btn ${filter === "all" ? "btn-primary" : ""}`} onClick={() => setFilter("all")}>
              All ({allUnits.length})
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
              disabled={filteredUnits.length === 0}
              onClick={() => setStudyMode("practice")}
            >
              Practice cases
            </button>
            <button
              className="btn"
              disabled={filteredUnits.length < 2}
              onClick={() => setStudyMode("match")}
            >
              Match
            </button>
          </div>

          {allUnits.length === 0 ? (
            <div className="empty-state">
              <h3>No cases yet</h3>
              <p>Switch to "Manage cases" to add your first patient scenario.</p>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="empty-state">
              <h3>Nothing in this filter</h3>
              <p>Try a different filter, or come back after practicing a bit.</p>
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Question</th>
                  <th>Box</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((u) => {
                  const state = getSrsState(deck, u.id);
                  return (
                    <tr key={u.id}>
                      <td>{u.stem.slice(0, 70)}{u.stem.length > 70 ? "…" : ""}</td>
                      <td>{u.prompt}</td>
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
            <button className="btn btn-primary" onClick={() => setShowAddCase(true)}>
              + Add case
            </button>
          </div>

          {deck.cases.length === 0 ? (
            <div className="empty-state">
              <h3>No cases yet</h3>
              <p>Add your first patient scenario with one or more questions.</p>
            </div>
          ) : (
            deck.cases.map((c) => (
              <div
                key={c.id}
                style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 14, marginBottom: 10, background: "white" }}
              >
                <div className="toolbar" style={{ marginBottom: 8 }}>
                  <span className="pill-meter-text">{c.questions.length} question{c.questions.length === 1 ? "" : "s"}</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-ghost" onClick={() => setEditingCase(c)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-danger" onClick={() => handleDeleteCase(c.id)}>
                    Delete
                  </button>
                </div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>{c.stem}</div>
                {c.questions.map((q, i) => (
                  <div key={i} style={{ fontSize: 13, marginBottom: 3, color: "var(--ink-soft)" }}>
                    <strong style={{ color: "var(--sage-dark)" }}>Q{i + 1}:</strong> {q.prompt}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {showAddCase && <CaseEditor onSave={handleAddCase} onClose={() => setShowAddCase(false)} />}

      {editingCase && (
        <CaseEditor
          initial={{ stem: editingCase.stem, questions: editingCase.questions }}
          onSave={(input) => {
            updateCase(deck.id, {
              id: editingCase.id,
              stem: input.stem,
              questions: input.questions.map((q, i) => ({
                id: editingCase.questions[i]?.id ?? `${editingCase.id}-q${i}-${Date.now()}`,
                ...q,
              })),
            });
            setEditingCase(null);
            onDeckChanged();
          }}
          onClose={() => setEditingCase(null)}
        />
      )}
    </div>
  );
}
