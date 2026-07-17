import { useState } from "react";
import type { NewDrugInput, FieldEntry } from "../types";
import { uniqueKeys } from "../lib/fields";

interface Props {
  initial?: NewDrugInput;
  onSave: (drug: NewDrugInput) => void;
  onClose: () => void;
}

const DEFAULT_LABELS = ["Class", "Uses", "Side Effects", "Common Name"];

export default function CardEditor({ initial, onSave, onClose }: Props) {
  const [term, setTerm] = useState(initial?.term ?? "");
  const [rows, setRows] = useState<{ label: string; value: string }[]>(
    initial
      ? initial.fields.map((f) => ({ label: f.label, value: f.value }))
      : DEFAULT_LABELS.map((label) => ({ label, value: "" }))
  );

  function updateRow(i: number, key: "label" | "value", val: string) {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setRows((prev) => [...prev, { label: "", value: "" }]);
  }

  function handleSave() {
    const filled = rows.filter((r) => r.label.trim() || r.value.trim());
    const keys = uniqueKeys(filled.map((r) => r.label || "field"));
    const fields: FieldEntry[] = filled.map((r, i) => ({
      key: keys[i],
      label: r.label.trim() || "Field",
      value: r.value.trim(),
    }));
    onSave({ term: term.trim(), fields });
  }

  const canSave = term.trim().length > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? "Edit card" : "Add card"}</h2>
        <div style={{ marginBottom: 16 }}>
          <label>Drug name</label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Metformin"
            autoFocus
          />
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
          Facts about this drug
        </p>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, marginBottom: 8, alignItems: "start" }}
          >
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateRow(i, "label", e.target.value)}
              placeholder="Label (e.g. Side Effects)"
            />
            <textarea
              rows={1}
              value={row.value}
              onChange={(e) => updateRow(i, "value", e.target.value)}
              placeholder="Value"
            />
            <button className="btn btn-ghost btn-danger" onClick={() => removeRow(i)}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addRow} style={{ marginBottom: 20 }}>
          + Add fact
        </button>

        <div className="toolbar" style={{ marginBottom: 0, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave}>
            Save card
          </button>
        </div>
      </div>
    </div>
  );
}
