import { useState } from "react";
import type { NewDrugInput } from "../types";
import { extractRowsFromPdf } from "../lib/pdfParser";
import { extractTablesFromDocx } from "../lib/docxParser";
import type { DetectedTable } from "../lib/docxParser";
import { uniqueKeys } from "../lib/fields";

export interface ImportResult {
  title: string;
  drugs: NewDrugInput[];
}

interface Props {
  onParsed: (results: ImportResult[]) => void;
  onClose: () => void;
}

interface ColumnMap {
  isTerm: boolean;
  label: string; // empty = ignore this column
}

type Stage = "upload" | "parsing" | "selectTables" | "map" | "error";

export default function ImportFile({ onParsed, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("upload");
  const [tables, setTables] = useState<DetectedTable[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMap[]>([]);
  const [skipFirstRow, setSkipFirstRow] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState({ page: 0, total: 0 });

  async function handleFile(file: File) {
    setStage("parsing");
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      let detected: DetectedTable[] = [];

      if (ext === "docx") {
        detected = await extractTablesFromDocx(file);
      } else if (ext === "pdf") {
        const parsedRows = await extractRowsFromPdf(file, (page, total) =>
          setProgress({ page, total })
        );
        const cellRows = parsedRows.filter((r) => r.cells.length >= 2).map((r) => r.cells);
        if (cellRows.length > 0) {
          detected = [{ title: file.name.replace(/\.pdf$/i, ""), rows: cellRows }];
        }
      } else {
        setErrorMsg("Please upload a .pdf or .docx file.");
        setStage("error");
        return;
      }

      if (detected.length === 0) {
        setErrorMsg(
          "Couldn't find table-like content in this file. It may use a layout this parser doesn't recognize yet — try adding cards manually, or a different export of the same content."
        );
        setStage("error");
        return;
      }

      setTables(detected);
      setSelected(detected.map(() => true));
      setTitles(detected.map((t) => t.title));

      if (detected.length === 1) {
        beginMapping(detected, [true]);
      } else {
        setStage("selectTables");
      }
    } catch (e) {
      setErrorMsg(
        "Something went wrong reading that file. Make sure it's a valid, non-password-protected PDF or Word (.docx) file."
      );
      setStage("error");
    }
  }

  function beginMapping(detected: DetectedTable[], sel: boolean[]) {
    const chosen = detected.filter((_, i) => sel[i]);
    const maxCols = Math.max(...chosen.map((t) => Math.max(...t.rows.map((r) => r.length))));
    setMapping(guessMapping(chosen[0]?.rows[0] ?? [], maxCols));
    setStage("map");
  }

  function guessMapping(headerRow: string[], maxCols: number): ColumnMap[] {
    let termIdx = 0;
    headerRow.forEach((h, i) => {
      if (/drug|generic|name|medication/i.test(h)) termIdx = i;
    });
    return Array.from({ length: maxCols }, (_, i) => ({
      isTerm: i === termIdx,
      label: i === termIdx ? "" : (headerRow[i] ?? "").trim(),
    }));
  }

  function setTermColumn(idx: number) {
    setMapping((prev) => prev.map((m, i) => ({ ...m, isTerm: i === idx })));
  }

  function setLabel(idx: number, label: string) {
    setMapping((prev) => prev.map((m, i) => (i === idx ? { ...m, label } : m)));
  }

  function buildResultsForTable(table: DetectedTable, title: string): ImportResult {
    const dataRows = skipFirstRow ? table.rows.slice(1) : table.rows;
    const termIdx = mapping.findIndex((m) => m.isTerm);
    const fieldCols = mapping.map((m, i) => ({ ...m, i })).filter((m) => !m.isTerm && m.label.trim());
    const keys = uniqueKeys(fieldCols.map((f) => f.label));

    const drugs: NewDrugInput[] = [];
    for (const row of dataRows) {
      const term = row[termIdx]?.trim() ?? "";
      if (!term) continue;
      const fields = fieldCols
        .map((f, fi) => ({ key: keys[fi], label: f.label.trim(), value: row[f.i]?.trim() ?? "" }))
        .filter((f) => f.value.length > 0);
      drugs.push({ term, fields });
    }
    return { title, drugs };
  }

  const selectedTables = tables.filter((_, i) => selected[i]);
  const previewTable = selectedTables[0];
  const previewDrugs = stage === "map" && previewTable ? buildResultsForTable(previewTable, "").drugs : [];
  const hasTermMapped = mapping.some((m) => m.isTerm);

  function handleConfirmMapping() {
    const results = tables
      .map((t, i) => ({ table: t, title: titles[i], sel: selected[i] }))
      .filter((x) => x.sel)
      .map((x) => buildResultsForTable(x.table, x.title.trim() || x.table.title));
    onParsed(results);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <h2>Import from file</h2>

        {stage === "upload" && (
          <div>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
              Upload a PDF or Word (.docx) file with drug tables. This is
              parsed entirely in your browser — nothing is uploaded to any
              server or AI API. If the file has multiple tables (e.g. one per
              quiz/topic), you'll get to pick which ones to bring in.
            </p>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === "parsing" && (
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
              Reading file{progress.total ? ` — page ${progress.page} of ${progress.total}` : "..."}
            </p>
            <div className="toolbar" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === "error" && (
          <div>
            <p style={{ color: "var(--brick)", fontSize: 14, lineHeight: 1.5 }}>{errorMsg}</p>
            <div className="toolbar" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button className="btn" onClick={() => setStage("upload")}>
                Try another file
              </button>
            </div>
          </div>
        )}

        {stage === "selectTables" && (
          <div>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.5 }}>
              Found {tables.length} tables in this file. Choose which ones to
              import, and rename them if you'd like — each one you check will
              become its own flashcard set (you'll map the columns once,
              since they usually share the same layout).
            </p>
            {tables.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={selected[i]}
                  onChange={(e) =>
                    setSelected((prev) => prev.map((s, idx) => (idx === i ? e.target.checked : s)))
                  }
                />
                <input
                  type="text"
                  value={titles[i]}
                  onChange={(e) => setTitles((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))}
                  style={{ flex: 1 }}
                />
                <span className="pill-meter-text">{t.rows.length - 1} entries</span>
              </div>
            ))}
            <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!selected.some(Boolean)}
                onClick={() => beginMapping(tables, selected)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {stage === "map" && previewTable && (
          <div>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.5 }}>
              Pick which column is the drug name, and type in a label for
              each other column you want to keep (leave blank to skip a
              column). This mapping applies to all {selectedTables.length}{" "}
              selected table{selectedTables.length === 1 ? "" : "s"}.
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={skipFirstRow}
                onChange={(e) => setSkipFirstRow(e.target.checked)}
              />
              <span style={{ textTransform: "none", fontFamily: "var(--font-body)", fontSize: 13 }}>
                First row of each table is a header (not a real drug entry)
              </span>
            </label>

            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, marginBottom: 18 }}>
              {mapping.map((col, i) => (
                <div key={i} style={{ minWidth: 170, flex: "0 0 auto" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <input
                      type="radio"
                      name="term-col"
                      style={{ width: "auto" }}
                      checked={col.isTerm}
                      onChange={() => setTermColumn(i)}
                    />
                    <span style={{ textTransform: "none", fontFamily: "var(--font-body)", fontSize: 12 }}>
                      Drug name
                    </span>
                  </label>
                  <input
                    type="text"
                    value={col.isTerm ? "" : col.label}
                    disabled={col.isTerm}
                    onChange={(e) => setLabel(i, e.target.value)}
                    placeholder={col.isTerm ? "(used as drug name)" : "Label, or leave blank to skip"}
                    style={{ marginBottom: 8 }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 4,
                      padding: 6,
                      background: "white",
                      maxHeight: 90,
                      overflowY: "auto",
                    }}
                  >
                    {previewTable.rows.slice(skipFirstRow ? 1 : 0, (skipFirstRow ? 1 : 0) + 3).map((row, ri) => (
                      <div key={ri} style={{ marginBottom: 3 }}>
                        {row[i] || <em>—</em>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {!hasTermMapped && (
              <p style={{ color: "var(--brick)", fontSize: 13 }}>
                Pick one column as the drug name to continue.
              </p>
            )}

            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>
              e.g. {previewDrugs.length} drug entr{previewDrugs.length === 1 ? "y" : "ies"} from "
              {previewTable.title}". You'll review and edit everything next.
            </p>

            <div className="toolbar" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              {tables.length > 1 && (
                <button className="btn" onClick={() => setStage("selectTables")}>
                  ← Back to tables
                </button>
              )}
              <button className="btn btn-primary" disabled={!hasTermMapped} onClick={handleConfirmMapping}>
                Review cards
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
