import { useEffect, useRef, useState } from "react";
import { deleteRecording, getRecording, saveRecording } from "../lib/audioStore";

interface Props {
  drugId: string;
  term: string;
  onClose: () => void;
  onChanged: () => void; // let the parent refresh its "has recording" set
}

export default function PronunciationRecorder({ drugId, term, onClose, onChanged }: Props) {
  const [recording, setRecording] = useState(false);
  const [newBlobUrl, setNewBlobUrl] = useState<string | null>(null);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const newBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    getRecording(drugId).then((blob) => {
      if (blob) setExistingUrl(URL.createObjectURL(blob));
    });
    return () => {
      if (newBlobUrl) URL.revokeObjectURL(newBlobUrl);
      if (existingUrl) URL.revokeObjectURL(existingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drugId]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        newBlobRef.current = blob;
        setNewBlobUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone. Check your browser's mic permissions for this site.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleSave() {
    if (!newBlobRef.current) return;
    await saveRecording(drugId, newBlobRef.current);
    onChanged();
    onClose();
  }

  async function handleDelete() {
    await deleteRecording(drugId);
    onChanged();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2>🎙 Record pronunciation</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: -8, marginBottom: 16 }}>
          Say <strong>{term}</strong> out loud — this plays back during study mode.
          Stored only in this browser, not uploaded anywhere.
        </p>

        {error && <p style={{ color: "var(--brick)", fontSize: 13 }}>{error}</p>}

        {!newBlobUrl ? (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <button
              className={`btn ${recording ? "btn-danger" : "btn-primary"}`}
              onClick={recording ? stopRecording : startRecording}
              style={{ fontSize: 15, padding: "12px 24px" }}
            >
              {recording ? "⏹ Stop recording" : "🎙 Start recording"}
            </button>
            {recording && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--brick)", marginTop: 10 }}>
                ● Recording...
              </p>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>New recording:</p>
            <audio controls src={newBlobUrl} style={{ width: "100%" }} />
            <button
              className="btn btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                setNewBlobUrl(null);
                newBlobRef.current = null;
              }}
            >
              Re-record
            </button>
          </div>
        )}

        {existingUrl && !newBlobUrl && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>Current recording:</p>
            <audio controls src={existingUrl} style={{ width: "100%" }} />
          </div>
        )}

        <div className="toolbar" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {existingUrl && !newBlobUrl && (
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete recording
            </button>
          )}
          {newBlobUrl && (
            <button className="btn btn-primary" onClick={handleSave}>
              Save recording
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
