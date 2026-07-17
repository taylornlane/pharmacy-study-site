import JSZip from "jszip";

export interface DetectedTable {
  title: string; // best-guess name (nearby heading text), editable by the user
  rows: string[][];
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Extracts every table in a .docx, using the nearest preceding paragraph of
 * text as a suggested title (this is how real class handouts are usually
 * organized - "Quiz 1: ...", "Quiz 2: ...", each followed by its own table).
 * Runs fully in the browser: unzips the docx and reads its XML directly, no
 * server or AI API involved.
 */
export async function extractTablesFromDocx(file: File): Promise<DetectedTable[]> {
  const zip = await JSZip.loadAsync(file);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("Not a valid .docx file (missing word/document.xml)");
  const xmlText = await docXmlFile.async("text");
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
  if (!body) throw new Error("Couldn't read document body");

  const tables: DetectedTable[] = [];
  let lastHeadingText = "";
  let tableCount = 0;

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    if (el.localName === "p") {
      const text = getParagraphText(el).trim();
      if (text) lastHeadingText = text;
    } else if (el.localName === "tbl") {
      tableCount++;
      const rows = extractTableRows(el);
      if (rows.length > 0) {
        tables.push({
          title: lastHeadingText || `Table ${tableCount}`,
          rows,
        });
      }
      lastHeadingText = "";
    }
  }

  return tables;
}

function getParagraphText(p: Element): string {
  const runs = Array.from(p.getElementsByTagNameNS(W_NS, "t"));
  return runs.map((t) => t.textContent || "").join("");
}

function isBulletParagraph(p: Element): boolean {
  const pPr = Array.from(p.childNodes).find(
    (n) => n.nodeType === 1 && (n as Element).localName === "pPr"
  ) as Element | undefined;
  if (!pPr) return false;
  return pPr.getElementsByTagNameNS(W_NS, "numPr").length > 0;
}

function extractTableRows(tbl: Element): string[][] {
  const directTrs = Array.from(tbl.childNodes).filter(
    (n) => n.nodeType === 1 && (n as Element).localName === "tr"
  ) as Element[];

  return directTrs.map((tr) => {
    const tcs = Array.from(tr.childNodes).filter(
      (n) => n.nodeType === 1 && (n as Element).localName === "tc"
    ) as Element[];
    return tcs.map((tc) => extractCellText(tc));
  });
}

function extractCellText(tc: Element): string {
  const paragraphs = Array.from(tc.childNodes).filter(
    (n) => n.nodeType === 1 && (n as Element).localName === "p"
  ) as Element[];

  const lines = paragraphs
    .map((p) => {
      const text = getParagraphText(p).trim();
      if (!text) return "";
      return isBulletParagraph(p) ? `• ${text}` : text;
    })
    .filter((l) => l.length > 0);

  return lines.join("; ");
}
