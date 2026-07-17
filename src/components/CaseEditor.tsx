import { useState } from "react";
import type { NewCaseInput } from "../types";

interface Props {
  initial?: NewCaseInput;
  onSave: (input: NewCaseInput) => void;
  onClose: () => void;
}

export default function CaseEditor({ initial, onSave, onClose }: Props) {
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [questions, setQuestions] = useState<{ prompt: string; answer: string }[]>(
    initial?.questions.length ? initial.questions : [{ prompt: "", answer: "" }]
  );

  function updateQ(i: number, key: "prompt" | "answer", val: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  }

  function removeQ(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addQ() {
    setQuestions((prev) => [...prev, { prompt: "", answer: "" }]);
  }

  function handleSave() {
    const filled = questions.filter((q) => q.prompt.trim() && q.answer.trim());
    onSave({ stem: stem.trim(), questions: filled });
  }

  const canSave = stem.trim().length > 0 && questions.some((q) => q.prompt.trim() && q.answer.trim());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? "Edit patient case" : "Add patient case"}</h2>

        <div style={{ marginBottom: 16 }}>
          <label>Patient presentation (the case stem)</label>
          <textarea
            rows={4}
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            placeholder="e.g. 68 y/o male with T2DM, HTN, presents with A1c 9.2%, currently on metformin 1000mg BID..."
            autoFocus
          />
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
          Questions about this case
        </p>
        {questions.map((q, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 12, marginBottom: 10, background: "white" }}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <span className="tag">Q{i + 1}</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-danger" onClick={() => removeQ(i)}>
                ✕
              </button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label>Question</label>
              <textarea
                rows={2}
                value={q.prompt}
                onChange={(e) => updateQ(i, "prompt", e.target.value)}
                placeholder="e.g. What change would you recommend to this patient's regimen?"
              />
            </div>
            <div>
              <label>Model answer / rationale</label>
              <textarea
                rows={2}
                value={q.answer}
                onChange={(e) => updateQ(i, "answer", e.target.value)}
                placeholder="e.g. Add a GLP-1 agonist given cardiovascular benefit and A1c above goal..."
              />
            </div>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addQ} style={{ marginBottom: 20 }}>
          + Add question
        </button>

        <div className="toolbar" style={{ marginBottom: 0, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canSave} onClick={handleSave}>
            Save case
          </button>
        </div>
      </div>
    </div>
  );
}
