import JSZip from "jszip";
import type { Deck } from "../types";
import { uid } from "./uid";
import { loadDecks, saveDecks } from "./storage";
import { getRecording, listRecordingIds, saveRecording } from "./audioStore";

// Bundles one or more sets - plus any voice recordings attached to their
// drugs - into a single .rxcards (zip) file that can be downloaded, sent to
// someone else, and imported into their own browser. This is a manual,
// one-time transfer, not live syncing: there's no server in between.

interface ManifestDeck {
  name: string;
  kind: "drugs" | "cases";
  drugs: Deck["drugs"];
  cases: Deck["cases"];
  interactions: Deck["interactions"];
}

interface Manifest {
  version: 1;
  exportedAt: string;
  decks: ManifestDeck[];
}

function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "audio";
}

export async function exportDecks(decks: Deck[]): Promise<Blob> {
  const zip = new JSZip();
  const recordingIds = await listRecordingIds();

  const manifest: Manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: decks.map((d) => ({
      name: d.name,
      kind: d.kind,
      drugs: d.drugs,
      cases: d.cases,
      interactions: d.interactions,
    })),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const audioFolder = zip.folder("audio")!;
  for (const deck of decks) {
    for (const drug of deck.drugs) {
      if (recordingIds.has(drug.id)) {
        const blob = await getRecording(drug.id);
        if (blob) {
          audioFolder.file(`${drug.id}.${extensionForMime(blob.type)}`, blob);
        }
      }
    }
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportSummary {
  setsImported: number;
  cardsImported: number;
  recordingsImported: number;
}

export async function importBundle(file: File): Promise<ImportSummary> {
  const zip = await JSZip.loadAsync(file);
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) {
    throw new Error("That doesn't look like an RxCards export file (missing manifest.json).");
  }
  const manifest: Manifest = JSON.parse(await manifestEntry.async("text"));

  // Index audio files in the zip by their basename (drug id, no extension)
  // so we can look them up regardless of the audio format used.
  const audioByOldId = new Map<string, JSZip.JSZipObject>();
  zip.folder("audio")?.forEach((relativePath, fileObj) => {
    const base = relativePath.replace(/\.[^.]+$/, "");
    audioByOldId.set(base, fileObj);
  });

  const existing = loadDecks();
  let cardsImported = 0;
  let recordingsImported = 0;

  for (const md of manifest.decks) {
    const idMap = new Map<string, string>();
    const newDrugs = md.drugs.map((dr) => {
      const newId = uid();
      idMap.set(dr.id, newId);
      return { ...dr, id: newId };
    });
    const newCases = md.cases.map((c) => ({
      ...c,
      id: uid(),
      questions: c.questions.map((q) => ({ ...q, id: uid() })),
    }));
    const newInteractions = (md.interactions ?? [])
      .filter((ix) => idMap.has(ix.drugAId) && idMap.has(ix.drugBId))
      .map((ix) => ({
        ...ix,
        id: uid(),
        drugAId: idMap.get(ix.drugAId)!,
        drugBId: idMap.get(ix.drugBId)!,
      }));

    const newDeck: Deck = {
      id: uid(),
      name: md.name,
      createdAt: Date.now(),
      kind: md.kind,
      drugs: newDrugs,
      cases: newCases,
      interactions: newInteractions,
      srs: {}, // start fresh - SRS progress belongs to whoever studies, not the exporter
    };
    existing.unshift(newDeck);
    cardsImported += newDrugs.length + newCases.reduce((s, c) => s + c.questions.length, 0);

    for (const [oldId, newId] of idMap) {
      const fileObj = audioByOldId.get(oldId);
      if (fileObj) {
        const blob = await fileObj.async("blob");
        await saveRecording(newId, blob);
        recordingsImported++;
      }
    }
  }

  saveDecks(existing);
  return { setsImported: manifest.decks.length, cardsImported, recordingsImported };
}
