import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedRow {
  cells: string[];
  page: number;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Extracts row/column structure from a PDF using the x/y position of each
 * text run. This works entirely locally (no API calls). It groups text into
 * lines by y-coordinate, then splits each line into columns wherever there's
 * a horizontal gap noticeably larger than a normal word-space, which is how
 * table columns typically look once text is pulled out of a PDF.
 */
export async function extractRowsFromPdf(
  file: File,
  onProgress?: (page: number, totalPages: number) => void
): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const rows: ParsedRow[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: PositionedItem[] = (content.items as any[])
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width ?? it.str.length * 5,
      }));

    // Group into lines: sort top-to-bottom (pdf.js y grows upward, so descending),
    // then cluster items whose y is within a small tolerance of each other.
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: PositionedItem[][] = [];
    const Y_TOLERANCE = 3;
    for (const item of items) {
      const line = lines.find(
        (l) => Math.abs(l[0].y - item.y) <= Y_TOLERANCE
      );
      if (line) line.push(item);
      else lines.push([item]);
    }

    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);

      // Compute a gap threshold relative to the average character width on
      // this line, so it adapts to different font sizes.
      const avgCharWidth =
        line.reduce((sum, it) => sum + it.width / Math.max(it.str.length, 1), 0) /
        line.length;
      const GAP_THRESHOLD = Math.max(avgCharWidth * 2.5, 8);

      const cells: string[] = [];
      let current = line[0].str;
      let prevEnd = line[0].x + line[0].width;

      for (let i = 1; i < line.length; i++) {
        const item = line[i];
        const gap = item.x - prevEnd;
        if (gap > GAP_THRESHOLD) {
          cells.push(current.trim());
          current = item.str;
        } else {
          // Same cell/word grouping - add a space if the gap looks like a
          // real word-space rather than glyphs glued together.
          current += gap > avgCharWidth * 0.3 ? " " + item.str : item.str;
        }
        prevEnd = item.x + item.width;
      }
      cells.push(current.trim());

      if (cells.some((c) => c.length > 0)) {
        rows.push({ cells, page: pageNum });
      }
    }

    onProgress?.(pageNum, doc.numPages);
  }

  return rows;
}

/**
 * Fallback / alternative parse: some source docs use a "labeled" format
 * instead of true table columns, e.g.:
 *   Metformin
 *   Class: Biguanide
 *   Uses: Type 2 diabetes
 *   Side Effects: GI upset, lactic acidosis
 * This scans raw page text for label keywords and groups lines into records.
 */
export async function extractLabeledRecordsFromPdf(
  file: File
): Promise<{ term: string; fields: Record<string, string> }[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  const labelPattern =
    /^(class|drug class|category|uses?|indications?|side effects?|adverse effects?|notes?|mechanism|moa)\s*[:\-]\s*(.*)$/i;

  const records: { term: string; fields: Record<string, string> }[] = [];
  let current: { term: string; fields: Record<string, string> } | null = null;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = (content.items as any[])
      .map((it) => it.str)
      .join("\n");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines) {
      const match = line.match(labelPattern);
      if (match) {
        if (!current) continue;
        const key = normalizeFieldKey(match[1]);
        current.fields[key] = (current.fields[key] ? current.fields[key] + " " : "") + match[2].trim();
      } else {
        // Treat as a new drug name/heading if it's short-ish and doesn't look
        // like a continuation sentence.
        if (current) records.push(current);
        current = { term: line, fields: {} };
      }
    }
  }
  if (current) records.push(current);

  return records.filter((r) => Object.keys(r.fields).length > 0);
}

function normalizeFieldKey(raw: string): string {
  const k = raw.toLowerCase();
  if (k.includes("class") || k.includes("category")) return "drugClass";
  if (k.includes("use") || k.includes("indication")) return "uses";
  if (k.includes("side") || k.includes("adverse")) return "sideEffects";
  return "notes";
}
