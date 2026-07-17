import { useMemo, useState } from "react";
import type { Deck, NewDrugInput } from "../types";
import { deckMasteryPercent, stateGetterForDeck } from "../lib/srs";
import { buildFactCards } from "../lib/factCards";
import { buildCaseUnits } from "../lib/caseCards";
import { downloadBlob, exportDecks, importBundle } from "../lib/exportImport";
import type { ImportSummary } from "../lib/exportImport";
import ImportFile from "./ImportFile";
import type { ImportResult } from "./ImportFile";
import ReviewImportedCards from "./ReviewImportedCards";

interface Props {
  decks: Deck[];
  onOpenDeck: (deckId: string) => void;
  onOpenCram: () => void;
  onOpenPK: () => void;
  onOpenStats: () => void;
  onSetupFallP2: () => void;
  onCreateDeck: (name: string) => void;
  onCreateDeckWithDrugs: (name: string, drugs: NewDrugInput[]) => void;
  onCreateCaseDeck: (name: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onDecksImported: () => void;
}

type SortKey = "recent" | "name" | "cards" | "mastery";

export default function DeckList({ decks, onOpenDeck, onOpenCram, onOpenPK, onOpenStats, onSetupFallP2, onCreateDeck, onCreateDeckWithDrugs, onCreateCaseDeck, onDeleteDeck, onDecksImported }: Props) {
  const [showNewChoice, setShowNewChoice] = useState(false);
  const [showImportBundle, setShowImportBundle] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showBlankForm, setShowBlankForm] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportResult[] | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  function submitBlank() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateDeck(trimmed);
    setName("");
    setShowBlankForm(false);
  }

  function submitCase() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateCaseDeck(trimmed);
    setName("");
    setShowCaseForm(false);
  }

  async function handleExportAll() {
    if (decks.length === 0) return;
    setExporting(true);
    try {
      const blob = await exportDecks(decks);
      downloadBlob(blob, "rxcards-all-sets.rxcards");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImportError("");
    setImportSummary(null);
    try {
      const summary = await importBundle(file);
      setImportSummary(summary);
      onDecksImported();
    } catch (e: any) {
      setImportError(e?.message || "Couldn't read that file. Make sure it's a .rxcards export.");
    }
  }

  const visibleDecks = useMemo(() => {
    let list = decks;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    const withStats = list.map((d) => {
      const getState = stateGetterForDeck(d);
      if (d.kind === "cases") {
        const units = buildCaseUnits(d.cases);
        return { deck: d, cardCount: units.length, mastery: deckMasteryPercent(units, getState) };
      }
      const units = buildFactCards(d.drugs);
      return { deck: d, cardCount: units.length, mastery: deckMasteryPercent(units, getState) };
    });
    withStats.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.deck.name.localeCompare(b.deck.name);
        case "cards":
          return b.cardCount - a.cardCount;
        case "mastery":
          return b.mastery - a.mastery;
        default:
          return b.deck.createdAt - a.deck.createdAt;
      }
    });
    return withStats;
  }, [decks, query, sortKey]);

  const FALL_P2_NAMES = [
    "PharmSci 608 - Basic & Clinical PK",
    "MedChem 600 - Principles of Drug Action III",
    "Pharmacy 602 - Therapeutic Problem Solving I",
  ];
  const missingP2Courses = FALL_P2_NAMES.some((n) => !decks.some((d) => d.name === n));

  return (
    <div>
      {missingP2Courses && (
        <div
          style={{
            border: "1.5px dashed var(--sage)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Set up empty sets for your Fall P2 courses (PK, MedChem 600, Therapeutic Problem Solving I)?
          </span>
          <button className="btn btn-primary" onClick={onSetupFallP2}>
            Set up Fall P2 courses
          </button>
        </div>
      )}

      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <input
          type="text"
          placeholder="Search sets..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ maxWidth: 160 }}>
          <option value="recent">Newest first</option>
          <option value="name">Name (A-Z)</option>
          <option value="cards">Most cards</option>
          <option value="mastery">Highest mastery</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={onOpenCram}>
          🔥 Cram
        </button>
        <button className="btn" onClick={onOpenPK}>
          📐 PK Practice
        </button>
        <button className="btn" onClick={onOpenStats}>
          🏆 Stats
        </button>
        <button className="btn" disabled={decks.length === 0 || exporting} onClick={handleExportAll}>
          {exporting ? "Exporting..." : "⬇ Export all"}
        </button>
        <button className="btn" onClick={() => setShowImportBundle(true)}>
          ⬆ Import
        </button>
        <button className="btn btn-primary" onClick={() => setShowNewChoice(true)}>
          + New set
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">
          <h3>No sets yet</h3>
          <p>Create a set, then import a drug table PDF or add cards by hand.</p>
        </div>
      ) : visibleDecks.length === 0 ? (
        <div className="empty-state">
          <h3>No sets match "{query}"</h3>
        </div>
      ) : (
        <div className="deck-grid">
          {visibleDecks.map(({ deck, cardCount, mastery }) => (
            <button key={deck.id} className="deck-tile" onClick={() => onOpenDeck(deck.id)}>
              <h3>{deck.kind === "cases" ? "🩺 " : ""}{deck.name}</h3>
              <div className="meta">
                {cardCount} {deck.kind === "cases" ? "question" : "card"}{cardCount === 1 ? "" : "s"} · {mastery}% mastered
              </div>
              <div
                className="btn btn-ghost btn-danger"
                style={{ marginTop: 10, display: "inline-block", fontSize: 12, padding: "4px 10px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete set "${deck.name}"? This can't be undone.`)) {
                    onDeleteDeck(deck.id);
                  }
                }}
              >
                Delete
              </div>
            </button>
          ))}
        </div>
      )}

      {showNewChoice && (
        <div className="modal-backdrop" onClick={() => setShowNewChoice(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2>New set</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: -8 }}>
              Start from a file, build a blank drug set, or create a patient case set.
            </p>
            <div className="toolbar" style={{ marginBottom: 12, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowNewChoice(false);
                  setShowImport(true);
                }}
              >
                Import from file
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowNewChoice(false);
                  setShowBlankForm(true);
                }}
              >
                Blank drug set
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowNewChoice(false);
                  setShowCaseForm(true);
                }}
              >
                Patient case set
              </button>
            </div>
            <div className="toolbar" style={{ marginBottom: 0, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowNewChoice(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlankForm && (
        <div className="modal-backdrop" onClick={() => setShowBlankForm(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2>New set</h2>
            <div className="field-grid">
              <div>
                <label>Set name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitBlank()}
                  placeholder="e.g. Cardiovascular Pharmacology"
                />
              </div>
            </div>
            <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowBlankForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitBlank}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showCaseForm && (
        <div className="modal-backdrop" onClick={() => setShowCaseForm(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2>New patient case set</h2>
            <div className="field-grid">
              <div>
                <label>Set name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitCase()}
                  placeholder="e.g. Diabetes Case Workups"
                />
              </div>
            </div>
            <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowCaseForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitCase}>
                Create
              </button>
            </div>
          </div>
        </div>
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
          existingSetName={null}
          onConfirm={(groups) => {
            for (const g of groups) {
              onCreateDeckWithDrugs(g.name, g.drugs);
            }
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {showImportBundle && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowImportBundle(false);
            setImportSummary(null);
            setImportError("");
          }}
        >
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2>Import sets</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: -8 }}>
              Import a <code>.rxcards</code> file someone exported for you — sets and any voice
              recordings come along, and get added as new sets (existing sets aren't touched).
            </p>

            {!importSummary && (
              <input
                type="file"
                accept=".rxcards,.zip"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                }}
              />
            )}

            {importError && <p style={{ color: "var(--brick)", fontSize: 13, marginTop: 10 }}>{importError}</p>}

            {importSummary && (
              <p style={{ fontSize: 14, marginTop: 10 }}>
                Imported {importSummary.setsImported} set{importSummary.setsImported === 1 ? "" : "s"},{" "}
                {importSummary.cardsImported} card{importSummary.cardsImported === 1 ? "" : "s"}
                {importSummary.recordingsImported > 0
                  ? `, and ${importSummary.recordingsImported} voice recording${importSummary.recordingsImported === 1 ? "" : "s"}`
                  : ""}
                .
              </p>
            )}

            <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowImportBundle(false);
                  setImportSummary(null);
                  setImportError("");
                }}
              >
                {importSummary ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
