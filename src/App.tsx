import { useEffect, useState } from "react";
import type { Deck, NewDrugInput } from "./types";
import { createCaseDeck, createDeck, deleteDeck, getDeck, loadDecks } from "./lib/storage";
import DeckList from "./components/DeckList";
import DeckView from "./components/DeckView";
import CaseDeckView from "./components/CaseDeckView";
import CramStudy from "./components/CramStudy";
import PKPractice from "./components/PKPractice";
import PomodoroWidget from "./components/PomodoroWidget";
import StatsView from "./components/StatsView";
import RxWordle from "./components/RxWordle";

const FALL_P2_COURSES: { name: string; kind: "drugs" | "cases" }[] = [
  { name: "PharmSci 608 - Basic & Clinical PK", kind: "drugs" },
  { name: "MedChem 600 - Principles of Drug Action III", kind: "drugs" },
  { name: "Pharmacy 602 - Therapeutic Problem Solving I", kind: "cases" },
];

export default function App() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [showCram, setShowCram] = useState(false);
  const [showPK, setShowPK] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showWordle, setShowWordle] = useState(false);

  function refresh() {
    setDecks(loadDecks());
  }

  function setupFallP2Courses() {
    const existingNames = new Set(loadDecks().map((d) => d.name));
    for (const course of FALL_P2_COURSES) {
      if (existingNames.has(course.name)) continue;
      if (course.kind === "drugs") createDeck(course.name);
      else createCaseDeck(course.name);
    }
    refresh();
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeDeck = activeDeckId ? getDeck(activeDeckId) : undefined;

  return (
    <div className="app-shell">
      <header className="rx-header">
        <div>
          <h1>
            <span className="rx-crossmark">℞</span>Cards
          </h1>
          <div className="subtitle">Pharmacy study cards</div>
        </div>
      </header>

      {showStats ? (
        <StatsView onExit={() => setShowStats(false)} />
      ) : showWordle ? (
        <RxWordle onExit={() => setShowWordle(false)} />
      ) : showPK ? (
        <PKPractice onExit={() => setShowPK(false)} />
      ) : showCram ? (
        <CramStudy
          decks={decks}
          onExit={() => {
            setShowCram(false);
            refresh();
          }}
          onChanged={refresh}
        />
      ) : activeDeck ? (
        activeDeck.kind === "cases" ? (
          <CaseDeckView
            deck={activeDeck}
            onBack={() => {
              setActiveDeckId(null);
              refresh();
            }}
            onDeckChanged={refresh}
          />
        ) : (
          <DeckView
            deck={activeDeck}
            onBack={() => {
              setActiveDeckId(null);
              refresh();
            }}
            onDeckChanged={refresh}
          />
        )
      ) : (
        <DeckList
          decks={decks}
          onOpenDeck={(id) => setActiveDeckId(id)}
          onOpenCram={() => setShowCram(true)}
          onOpenPK={() => setShowPK(true)}
          onOpenStats={() => setShowStats(true)}
          onOpenWordle={() => setShowWordle(true)}
          onSetupFallP2={setupFallP2Courses}
          onDecksImported={refresh}
          onCreateDeck={(name) => {
            createDeck(name);
            refresh();
          }}
          onCreateDeckWithDrugs={(name: string, drugs: NewDrugInput[]) => {
            const deck = createDeck(name, drugs);
            refresh();
            setActiveDeckId(deck.id);
          }}
          onCreateCaseDeck={(name: string) => {
            const deck = createCaseDeck(name);
            refresh();
            setActiveDeckId(deck.id);
          }}
          onDeleteDeck={(id) => {
            deleteDeck(id);
            refresh();
          }}
        />
      )}

      <PomodoroWidget />
    </div>
  );
}
