# RxCards — Pharmacy Study Cards

A Quizlet-style study app built specifically for pharmacy school drug flashcards,
with local PDF-to-flashcard import. No AI API calls — everything runs in the browser.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Deploying

This is a static Vite app. The easiest path is Vercel (same as your Trucker Path
deploy):

```bash
npm install -g vercel   # if not already installed
vercel
```

Or drag the `dist/` folder (after `npm run build`) into Netlify/Vercel's
dashboard for a manual deploy.

## How it works

- **Sets** each hold drug records. Each drug can have any number of
  freely-labeled facts attached (Class, Uses, Side Effects, Common Name, or
  anything you type — validated against a real 10-table, 106-drug Word doc).
  Sets & cards are stored in the browser's `localStorage` — no backend, no
  login, no server costs.
- **File import** supports both **PDF** (`src/lib/pdfParser.ts`, position-based
  table reconstruction) and **Word .docx** (`src/lib/docxParser.ts`, reads the
  actual table XML directly via JSZip — this handles multi-line/multi-value
  cells like "brand names" or bulleted indication lists correctly, which the
  PDF's position-based approach can't). Both run fully client-side, no AI API
  involved.
  - If the file has multiple tables (e.g. one per quiz/topic in a course
    handout), you're shown all of them and can pick which to bring in, with
    the nearest heading text used as a suggested set name for each.
  - Column mapping is free-text: you don't need to know the source headers in
    advance — you see a live preview of each column's actual content and just
    type in the label you want (or the app pre-fills the real header text
    when it can find one).
  - When creating new sets from multiple selected tables, you choose "create
    N separate sets" (default) or "combine into one set."
  - Every import ends with a full review/edit step (per drug, per fact)
    before anything is saved.
- **Atomic cards**: a drug with N facts becomes N separate study cards (e.g.
  Albuterol → Brand, Albuterol → Therapeutic class, Albuterol → Indications),
  each tracked for mastery independently.
- **Flashcards mode**: classic flip-to-reveal, one fact per card, styled like
  a prescription label.
- **Learn mode**: 5-box Leitner spaced-repetition per fact. Lower boxes are
  multiple choice; box 3+ switches to typed recall (type the drug name from
  its fact) for a harder test. Multiple-choice distractors are pulled from
  other cards with the same fact type in the set.
- **Known vs. Needs practice**: inside a set's Study tab, a filter splits
  cards into "Known" (box 4-5) and "Needs practice" (box 1-3), and you can
  launch Flashcards/Learn against just one group.
- **Set list**: search by name and sort by newest, name, card count, or
  mastery.

- **Patient case sets**: a separate set type for case-based practice. Each
  case has a presentation ("stem") and one or more questions with a model
  answer/rationale. Since there's no AI API to grade free-text clinical
  reasoning, practice mode works like Anki: you see the stem and question,
  think through (or type) your answer, reveal the model answer, and
  self-grade "needs more practice" / "I nailed it" — still gets full
  spaced-repetition tracking per question, just self-graded instead of
  auto-checked. No PDF/docx import for cases yet (manual entry only);
  see "next features" below.
- **Pomodoro timer**: a floating focus timer (bottom-right, always available
  regardless of which set/screen you're on) with configurable focus/break
  lengths, a short chime on phase change, the countdown mirrored in the
  browser tab title, and a running count of focus sessions completed today
  (persisted per day in localStorage).

- **Cram mode**: pools due cards across every drug set (not case sets yet) at
  once, so you're not studying set-by-set before an exam. Same Known/Needs
  practice filter, same Flashcards/Learn engines — reviews still write back
  to each card's original set correctly.
- **Fall P2 course setup**: a banner on the home screen offers to create
  empty, correctly-named sets for her actual Fall P2 courses (PharmSci 608 –
  Basic & Clinical PK, MedChem 600 – Principles of Drug Action III, and
  Pharmacy 602 – Therapeutic Problem Solving I as a patient case set). It
  only offers this until all three exist, and won't create duplicates.

- **Voice recordings**: record yourself (or anyone) saying a drug's name from
  the Manage tab (🎙 Record button per drug), stored locally via IndexedDB
  (not localStorage — audio blobs need real binary storage and more room
  than localStorage's ~5-10MB limit). A 🔊 button then shows up next to that
  drug's name in Flashcards and Learn mode, in Cram mode, everywhere the term
  appears — so studying gets to include hearing it said out loud. Recordings
  never leave the browser; nothing is uploaded anywhere.

- **Export / Import**: since everything (including voice recordings) lives
  only in the browser it was created in, there's no automatic syncing across
  devices or browsers. To get sets — and any attached recordings — onto
  someone else's device, export creates a `.rxcards` file (a zip with a
  manifest.json plus an audio folder) that can be sent however you'd send
  any file (email, AirDrop, Drive), and the recipient imports it into their
  own browser. This is a manual, one-time transfer, not live sync. "Export
  all" is on the home screen; "Export this set" is in each set's Manage tab
  for sending just one. Imported sets always start with fresh study
  progress (box 1) regardless of the exporter's progress, and get new
  internal IDs so they never collide with existing sets.

## Known limitations to iterate on

- The PDF parser assumes a genuine table layout (columns aligned by
  whitespace/position); it can struggle with cells that wrap across multiple
  lines with uneven heights (the .docx path handles this correctly since it
  reads real table structure, so if a PDF import looks garbled, try getting
  the original .docx/.doc if one exists).
- No live sync between devices/browsers — this is by design for v1 (no
  backend, no login, no server costs). Use Export/Import (see above) to move
  sets and voice recordings from one browser/device to another manually.
- No image/diagram support on cards yet.

## Suggested next features (pick based on what she actually needs)

1. "Match" game mode (drag-pair term to definition, timed)
2. Keyboard shortcuts in Learn/Flashcards (space to flip, 1-4 for choices)
3. Support .doc (older Word format) by converting to .docx first
4. Drug-drug interaction quizzes (relevant to Therapeutic Problem Solving I/II)
5. PK-focused calculation practice (half-life, clearance, Vd, dosing) with
   numeric answer checking — relevant to PharmSci 608
6. PDF/docx import for patient cases (currently manual entry only)
7. Include case sets in Cram mode (currently drug sets only)
