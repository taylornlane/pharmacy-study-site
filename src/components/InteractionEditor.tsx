import { useState } from "react";
import type { DrugRecord, InteractionSeverity, NewInteractionInput } from "../types";

interface Props {
  drugs: DrugRecord[];
  initial?: NewInteractionInput;
  onSave: (input: NewInteractionInput) => void;
  onClose: () => void;
}

const SEVERITIES: InteractionSeverity[] = ["minor", "moderate", "major"];

export default function InteractionEditor({ drugs, initial, onSave, onClose }: Props) {
  const [drugAId, setDrugAId] = useState(initial?.drugAId ?? drugs[0]?.id ?? "");
  const [drugBId, setDrugBId] = useState(initial?.drugBId ?? drugs[1]?.id ?? "");
  const [severity, setSeverity] = useState<InteractionSeverity>(initial?.severity ?? "moderate");
  const [description, setDescription] = useState(initial?.description ?? "");

  const canSave = drugAId && drugBId && drugAId !== drugBId && description.trim().length > 0;

  function handleSave() {
    onSave({ drugAId, drugBId, severity, description: description.trim() });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? "Edit interaction" : "Add interaction"}</h2>

        <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr", display: "grid" }}>
          <div>
            <label>Drug A</label>
            <select value={drugAId} onChange={(e) => setDrugAId(e.target.value)}>
              {drugs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.term}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Drug B</label>
            <select value={drugBId} onChange={(e) => setDrugBId(e.target.value)}>
              {drugs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.term}
                </option>
              ))}
            </select>
          </div>
        </div>
        {drugAId === drugBId && (
          <p style={{ color: "var(--brick)", fontSize: 13, marginTop: -8 }}>Pick two different drugs.</p>
        )}

        <div style={{ marginBottom: 16 }}>
          <label>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as InteractionSeverity)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Interaction (mechanism / effect / management)</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Additive CNS depression — increased risk of sedation and respiratory depression. Avoid combination or use lowest effective doses with close monitoring."
            autoFocus
          />
        </div>

        <div className="toolbar" style={{ marginBottom: 0, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave}>
            Save interaction
          </button>
        </div>
      </div>
    </div>
  );
}
