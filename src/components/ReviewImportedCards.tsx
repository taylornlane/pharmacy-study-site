import { useState } from "react";
import type { NewDrugInput } from "../types";
import type { ImportResult } from "./ImportFile";

interface Group {
  name: string;
  drugs: NewDrugInput[];
}

interface Props {
  results: ImportResult[];
  // If set, we're adding into an already-existing set (single flattened group, no naming).
  // If null, this import is creating new set(s) and needs name(s).
  existingSetName: string | null;
  onConfirm: (groups: Group[]) => void;
  onCancel: () => void;
}

export default function ReviewImportedCards({ results, existingSetName, onConfirm, onCancel }: Props) {
  const creatingNew = existingSetName === null;
  const multiTable = results.length > 1;

  const [combine, setCombine] = useState(false);
  const [combinedName, setCombinedName] = useState("");
  const [groups, setGroups] = useState<Group[]>(
    results.map((r) => ({ name: r.title, drugs: r.drugs }))
  );

  function updateDrugTerm(gi: number, di: number, term: string) {
    setGroups((prev) => {
      const next = [...prev];
      const drugs = [...next[gi].drugs];
      drugs[di] = { ...drugs[di], term };
      next[gi] = { ...next[gi], drugs };
      return next;
    });
  }

  function updateFieldValue(gi: number, di: number, fi: number, value: string) {
    setGroups((prev) => {
      const next = [...prev];
      const drugs = [...next[gi].drugs];
      const fields = [...drugs[di].fields];
      fields[fi] = { ...fields[fi], value };
      drugs[di] = { ...drugs[di], fields };
      next[gi] = { ...next[gi], drugs };
      return next;
    });
  }

  function removeDrug(gi: number, di: number) {
    setGroups((prev) => {
      const next = [...prev];
      next[gi] = { ...next[gi], drugs: next[gi].drugs.filter((_, idx) => idx !== di) };
      return next;
    });
  }

  function renameGroup(gi: number, name: string) {
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, name } : g)));
  }

  const totalCards = groups.reduce((sum, g) => sum + g.drugs.length, 0);

  function handleConfirm() {
    if (!creatingNew) {
      // Adding to an existing set: flatten everything into one group, name unused.
      const allDrugs = groups.flatMap((g) => g.drugs);
      onConfirm([{ name: existingSetName ?? "", drugs: allDrugs }]);
      return;
    }
    if (!multiTable || combine) {
      const allDrugs = groups.flatMap((g) => g.drugs);
      const name = multiTable ? combinedName.trim() : groups[0]?.name.trim();
      onConfirm([{ name: name || "Untitled set", drugs: allDrugs }]);
      return;
    }
    onConfirm(groups.map((g) => ({ name: g.name.trim() || "Untitled set", drugs: g.drugs })));
  }

  const canConfirm =
    totalCards > 0 &&
    (!creatingNew ||
      (multiTable && combine ? combinedName.trim().length > 0 : true) &&
      (!multiTable ? groups[0]?.name.trim().length > 0 : true) &&
      (multiTable && !combine ? groups.every((g) => g.name.trim().length > 0) : true));

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
        <h2>Review parsed cards</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: -8 }}>
          {existingSetName
            ? `Adding to "${existingSetName}". `
            : ""}
          Fix anything the parser got wrong, or remove rows that aren't real
          drug entries. Nothing is saved until you confirm.
        </p>

        {creatingNew && multiTable && (
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <button className={`btn ${!combine ? "btn-primary" : ""}`} onClick={() => setCombine(false)}>
              Create {results.length} separate sets
            </button>
            <button className={`btn ${combine ? "btn-primary" : ""}`} onClick={() => setCombine(true)}>
              Combine into one set
            </button>
          </div>
        )}

        {creatingNew && multiTable && combine && (
          <div style={{ marginBottom: 16 }}>
            <label>New set name</label>
            <input
              type="text"
              autoFocus
              value={combinedName}
              onChange={(e) => setCombinedName(e.target.value)}
              placeholder="e.g. Top 100 Medications"
            />
          </div>
        )}

        {creatingNew && !multiTable && (
          <div style={{ marginBottom: 16 }}>
            <label>New set name</label>
            <input
              type="text"
              autoFocus
              value={groups[0]?.name ?? ""}
              onChange={(e) => renameGroup(0, e.target.value)}
              placeholder="e.g. Cardiovascular Pharmacology"
            />
          </div>
        )}

        <div style={{ maxHeight: "48vh", overflowY: "auto", marginBottom: 16 }}>
          {groups.map((group, gi) => (
            <details key={gi} open={groups.length <= 2} style={{ marginBottom: 14 }}>
              <summary style={{ cursor: "pointer", marginBottom: 8 }}>
                {creatingNew && multiTable && !combine ? (
                  <input
                    type="text"
                    value={group.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => renameGroup(gi, e.target.value)}
                    style={{ display: "inline-block", width: 260, marginLeft: 6 }}
                  />
                ) : !creatingNew || multiTable ? (
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{group.name}</strong>
                ) : (
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>Cards</strong>
                )}{" "}
                <span className="pill-meter-text">({group.drugs.length} cards)</span>
              </summary>

              {group.drugs.map((drug, di) => (
                <div
                  key={di}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 8,
                    background: "white",
                  }}
                >
                  <div className="toolbar" style={{ marginBottom: 8 }}>
                    <span className="tag">#{di + 1}</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-ghost btn-danger" onClick={() => removeDrug(gi, di)}>
                      Remove
                    </button>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <label>Drug name</label>
                    <input
                      type="text"
                      value={drug.term}
                      onChange={(e) => updateDrugTerm(gi, di, e.target.value)}
                    />
                  </div>
                  {drug.fields.map((f, fi) => (
                    <div key={fi} style={{ marginBottom: 6 }}>
                      <label>{f.label}</label>
                      <textarea
                        rows={2}
                        value={f.value}
                        onChange={(e) => updateFieldValue(gi, di, fi, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ))}
              {group.drugs.length === 0 && (
                <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>No cards left in this set.</p>
              )}
            </details>
          ))}
        </div>

        <div className="toolbar" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canConfirm} onClick={handleConfirm}>
            {existingSetName
              ? `Add ${totalCards} card${totalCards === 1 ? "" : "s"} to set`
              : multiTable && !combine
              ? `Create ${groups.length} sets (${totalCards} cards)`
              : `Create set with ${totalCards} card${totalCards === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
