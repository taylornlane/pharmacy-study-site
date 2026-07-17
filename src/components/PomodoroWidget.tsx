import { useEffect, useRef, useState } from "react";

type Phase = "work" | "shortBreak" | "longBreak";

const DEFAULTS = { work: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLongBreak: 4 };
const SETTINGS_KEY = "rxcards.pomodoro.settings.v1";
const STATS_KEY = "rxcards.pomodoro.stats.v1";
const ORIGINAL_TITLE = document.title;

interface Settings {
  work: number;
  shortBreak: number;
  longBreak: number;
  cyclesBeforeLongBreak: number;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadTodayCount(): number {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return 0;
    const stats = JSON.parse(raw);
    return stats[todayKey()] ?? 0;
  } catch {
    return 0;
  }
}

function bumpTodayCount(): number {
  let stats: Record<string, number> = {};
  try {
    stats = JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}");
  } catch {
    /* ignore */
  }
  const key = todayKey();
  stats[key] = (stats[key] ?? 0) + 1;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats[key];
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio not available - fail silently */
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PHASE_LABEL: Record<Phase, string> = {
  work: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

export default function PomodoroWidget() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(settings.work * 60);
  const [running, setRunning] = useState(false);
  const [completedToday, setCompletedToday] = useState(loadTodayCount);
  const [cycleCount, setCycleCount] = useState(0);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handlePhaseComplete();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  useEffect(() => {
    if (running) {
      document.title = `${formatTime(secondsLeft)} · ${PHASE_LABEL[phase]} — RxCards`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
    return () => {
      document.title = ORIGINAL_TITLE;
    };
  }, [secondsLeft, running, phase]);

  function handlePhaseComplete() {
    playChime();
    setRunning(false);
    if (phase === "work") {
      const newCount = bumpTodayCount();
      setCompletedToday(newCount);
      const nextCycle = cycleCount + 1;
      setCycleCount(nextCycle);
      const nextPhase: Phase = nextCycle % settings.cyclesBeforeLongBreak === 0 ? "longBreak" : "shortBreak";
      setPhase(nextPhase);
      setSecondsLeft((nextPhase === "longBreak" ? settings.longBreak : settings.shortBreak) * 60);
    } else {
      setPhase("work");
      setSecondsLeft(settings.work * 60);
    }
  }

  function toggleRunning() {
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setPhase("work");
    setCycleCount(0);
    setSecondsLeft(settings.work * 60);
  }

  function skip() {
    setRunning(false);
    handlePhaseComplete();
  }

  function updateSetting(key: keyof Settings, value: number) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    if (!running && phase === "work" && key === "work") setSecondsLeft(value * 60);
    if (!running && phase === "shortBreak" && key === "shortBreak") setSecondsLeft(value * 60);
    if (!running && phase === "longBreak" && key === "longBreak") setSecondsLeft(value * 60);
  }

  const phaseColor = phase === "work" ? "var(--sage)" : "var(--amber)";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          borderRadius: 999,
          border: "1.5px solid var(--ink)",
          background: running ? phaseColor : "white",
          color: running ? "white" : "var(--ink)",
          padding: "10px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "2px 2px 0 var(--amber-soft)",
          zIndex: 40,
        }}
      >
        {running ? `⏱ ${formatTime(secondsLeft)}` : "⏱ Focus timer"}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 260,
        background: "var(--paper)",
        border: "1.5px solid var(--ink)",
        borderRadius: 8,
        boxShadow: "3px 3px 0 var(--amber-soft)",
        zIndex: 40,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: phaseColor,
          color: "white",
          padding: "8px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>{PHASE_LABEL[phase]}</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 16, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 42, marginBottom: 10 }}>
          {formatTime(secondsLeft)}
        </div>
        <div className="toolbar" style={{ justifyContent: "center", marginBottom: 8 }}>
          <button className="btn btn-primary" onClick={toggleRunning}>
            {running ? "Pause" : "Start"}
          </button>
          <button className="btn" onClick={skip}>
            Skip
          </button>
          <button className="btn btn-ghost" onClick={reset}>
            Reset
          </button>
        </div>
        <div className="pill-meter-text" style={{ marginBottom: 8 }}>
          🍅 {completedToday} focus session{completedToday === 1 ? "" : "s"} today
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "Hide settings" : "Timer settings"}
        </button>

        {showSettings && (
          <div style={{ marginTop: 10, textAlign: "left" }}>
            <div style={{ marginBottom: 8 }}>
              <label>Focus length (min)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settings.work}
                onChange={(e) => updateSetting("work", Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label>Short break (min)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settings.shortBreak}
                onChange={(e) => updateSetting("shortBreak", Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <label>Long break (min)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settings.longBreak}
                onChange={(e) => updateSetting("longBreak", Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
