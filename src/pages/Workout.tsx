import type { Exercise } from "../data/exercises";
import type { WorkoutSet } from "../store/useWorkoutStore";
import type { SpeechRecognitionHandle, SpeechWindow } from "../types/speech";
import { Sheet } from "../components/Sheet";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { useGamificationStore } from "../store/useGamificationStore";
import { useExerciseStore } from "../store/useExerciseStore";
import { useLanguageStore } from "../store/useLanguageStore";
import { useUserStore } from "../store/useUserStore";
import { PlateCalculator } from "../components/PlateCalculator";
import { INJURY_RISK_MAP, type SplitSystemId } from "../data/exercises";
import {
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Mic,
  MicOff,
  Edit3,
  ArrowLeftRight,
  Star,
  History,
  Plus,
  ChevronRight,
  Film,
  TrendingUp,
  Timer,
  SkipForward,
  ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";
import { useT } from "../hooks/useT";

import { RestTimer as CircularTimer } from "../components/RestTimer";

// ── Modals (Video, Swap, Notes) ────────────────────────────────────────────────
const ModalWrapper = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <Sheet title="OmniBody" onClose={onClose}>
    {children}
  </Sheet>
);

// ── Notes Modal with Dictation ──
const NotesModal = ({
  exerciseId,
  name,
  initNotes,
  onClose,
}: {
  exerciseId: string;
  name: string;
  initNotes?: string;
  onClose: () => void;
}) => {
  const t = useT();
  const [text, setText] = useState(initNotes || "");
  const [listening, setListening] = useState(false);
  const updateNotes = useWorkoutStore((s) => s.updateNotes);
  const recognitionRef = useRef<SpeechRecognitionHandle | null>(null);

  useEffect(() => {
    const SpeechRec =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let finalTranscript = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal)
            finalTranscript += e.results[i][0].transcript;
        }
        if (finalTranscript)
          setText((prev: string) => prev + (prev ? " " : "") + finalTranscript);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current)
      return alert("Speech recognition not supported in this browser.");
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const handleSave = () => {
    updateNotes(exerciseId, text);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        {t("workout.notes")}: {name}
      </h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="How did this exercise feel? Any pain?"
        style={{ width: "100%", marginBottom: "1rem" }}
      />
      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          onClick={toggleListen}
          className="btn-secondary"
          style={{
            flex: 1,
            borderColor: listening ? "var(--magenta)" : "var(--cyan)",
            color: listening ? "var(--magenta)" : "var(--cyan)",
          }}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}{" "}
          {listening ? t("workout.stop") : t("workout.dictate")}
        </button>
        <button
          onClick={handleSave}
          className="btn-primary"
          style={{ flex: 1 }}
        >
          {t("common.save")}
        </button>
      </div>
    </ModalWrapper>
  );
};

// ── Swap Modal ──
const SwapModal = ({
  currentExId,
  currentCategory,
  currentMuscle,
  onClose,
}: {
  currentExId: string;
  currentCategory: string;
  currentMuscle: string;
  onClose: () => void;
}) => {
  const t = useT();
  const swapExercise = useWorkoutStore((s) => s.swapExercise);
  const getAllExercises = useExerciseStore((s) => s.getAllExercises);
  const [search, setSearch] = useState("");

  const exercises = getAllExercises();

  // Deterministic progression suggestions
  const filtered = exercises.filter((e) => {
    if (e.id === currentExId) return false;
    if (search) return e.name.toLowerCase().includes(search.toLowerCase());
    return e.muscleGroup === currentMuscle || e.category === currentCategory;
  });

  const handleSwap = (newId: string) => {
    swapExercise(currentExId, newId);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        {t("workout.swap")}
      </h3>
      <input
        type="text"
        placeholder={t("workout.search_alt")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "1rem" }}
      />

      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {filtered.map((ex) => {
          const exName =
            useLanguageStore.getState().lang === "ar" && ex.nameAr
              ? ex.nameAr
              : ex.name;
          return (
            <button
              key={ex.id}
              onClick={() => handleSwap(ex.id)}
              style={{
                width: "100%",
                textAlign: "start",
                padding: "0.75rem",
                borderBottom: "1px solid rgba(0,240,255,0.1)",
                color: "var(--color-text)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                {exName}
              </div>
              <div
                style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}
              >
                {ex.category} · {ex.muscleGroup}
              </div>
            </button>
          );
        })}
      </div>
    </ModalWrapper>
  );
};

// ── Custom Exercise Manager Modal ──
const CustomExerciseManager = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const addCustomExercise = useExerciseStore((s) => s.addCustomExercise);
  const duplicateExercise = useExerciseStore((s) => s.duplicateExercise);
  const deleteCustomExercise = useExerciseStore((s) => s.deleteCustomExercise);
  const customExercises = useExerciseStore((s) => s.customExercises);

  const [mode, setMode] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Exercise["category"]>("Push");
  const [muscle, setMuscle] = useState("");

  const handleSave = () => {
    if (!name || !muscle) return alert("Name and muscle group required");
    addCustomExercise({
      id: crypto.randomUUID(),
      name,
      category,
      muscleGroup: muscle,
      isCustom: true,
      equipment: [],
      description: "",
      createdAt: Date.now(),
    });
    setMode("list");
    setName("");
    setMuscle("");
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        {mode === "list"
          ? t("workout.custom_manager")
          : t("workout.create_new")}
      </h3>

      {mode === "create" ? (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <input
              type="text"
              placeholder={t("workout.ex_name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Exercise["category"])
              }
            >
              {[
                "Push",
                "Pull",
                "Legs",
                "Neck",
                "Hand/Grip",
                "Face",
                "Eye",
                "Breathing",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Muscle Group (e.g. Biceps)"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setMode("list")}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              {t("common.save")}
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setMode("create")}
            className="btn-primary"
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            + {t("workout.create_new")}
          </button>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {customExercises.length === 0 ? (
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.85rem",
                  textAlign: "center",
                  padding: "1rem 0",
                }}
              >
                No custom exercises yet.
              </div>
            ) : (
              customExercises.map((ex) => (
                <div
                  key={ex.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    borderBottom: "1px solid rgba(0,240,255,0.1)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      {ex.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {ex.category} · {ex.muscleGroup}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => duplicateExercise(ex.id)}
                      style={{
                        color: "var(--cyan)",
                        fontSize: "0.75rem",
                        border: "1px solid var(--cyan)",
                        padding: "0.2rem 0.5rem",
                        borderRadius: 4,
                      }}
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => deleteCustomExercise(ex.id)}
                      style={{
                        color: "var(--magenta)",
                        fontSize: "0.75rem",
                        border: "1px solid var(--magenta)",
                        padding: "0.2rem 0.5rem",
                        borderRadius: 4,
                      }}
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </ModalWrapper>
  );
};

// ── Exercise History Modal ──
const HistoryModal = ({
  exerciseId,
  name,
  onClose,
}: {
  exerciseId: string;
  name: string;
  onClose: () => void;
}) => {
  const t = useT();
  const history = useWorkoutStore((s) => s.history);

  // Find all instances of this exercise in history
  const instances = history
    .map((session) => {
      const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
      if (!ex) return null;
      return { date: session.date, sets: ex.sets };
    })
    .filter((v) => v !== null)
    .sort((a, b) => a.date - b.date)
    .slice(-10); // Last 10 sessions

  return (
    <ModalWrapper onClose={onClose}>
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        {t("workout.history")}: {name}
      </h3>
      {instances.length === 0 ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          No history found for this exercise.
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {instances.map((inst, idx: number) => {
            const bestSet = inst.sets
              .filter((s) => s.completed)
              .reduce<WorkoutSet | null>(
                (best, s) => (!best || s.weight > best.weight ? s : best),
                null,
              );
            return (
              <div
                key={idx}
                style={{
                  marginBottom: "1rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid rgba(0,240,255,0.1)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--cyan)",
                    fontFamily: "var(--font-mono)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {new Date(inst.date).toLocaleDateString()}
                </div>
                {inst.sets.map(
                  (set) =>
                    set.completed && (
                      <div
                        key={set.setNumber}
                        style={{
                          fontSize: "0.85rem",
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "0.2rem",
                        }}
                      >
                        <span style={{ color: "var(--color-text-muted)" }}>
                          Set {set.setNumber}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {set.weight}kg x {set.reps}{" "}
                          <span
                            style={{
                              color: "var(--color-text-muted)",
                              fontSize: "0.7rem",
                            }}
                          >
                            (RPE {set.rpe})
                          </span>
                        </span>
                      </div>
                    ),
                )}
                {bestSet && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--gold)",
                      marginTop: "0.5rem",
                    }}
                  >
                    {t("workout.top_set")}: {bestSet.weight}kg x {bestSet.reps}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalWrapper>
  );
};

// ── Add Exercise Modal ─────────────────────────────────────────────────────────
const AddExerciseModal = ({ onClose }: { onClose: () => void }) => {
  const t = useT();
  const addExercise = useWorkoutStore((s) => s.addExerciseToSession);
  const getAllExercises = useExerciseStore((s) => s.getAllExercises);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const [search, setSearch] = useState("");

  const exercises = getAllExercises();
  const existingIds = activeSession?.exercises.map((e) => e.exerciseId) || [];

  const filtered = exercises.filter((e) => {
    if (existingIds.includes(e.id)) return false;
    if (search) return e.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const handleAdd = (newId: string) => {
    addExercise(newId);
    onClose();
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        {t("workout.add_exercise")}
      </h3>
      <input
        type="text"
        placeholder={t("workout.search_alt")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "1rem" }}
      />

      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {filtered.map((ex) => {
          const exName =
            useLanguageStore.getState().lang === "ar" && ex.nameAr
              ? ex.nameAr
              : ex.name;
          return (
            <button
              key={ex.id}
              onClick={() => handleAdd(ex.id)}
              style={{
                width: "100%",
                textAlign: "start",
                padding: "0.75rem",
                borderBottom: "1px solid rgba(0,240,255,0.1)",
                color: "var(--color-text)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                {exName}
              </div>
              <div
                style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}
              >
                {ex.category} · {ex.muscleGroup}
              </div>
            </button>
          );
        })}
      </div>
    </ModalWrapper>
  );
};

// ── Warmup & Cooldown Checklists ──────────────────────────────────────────────
const ChecklistPhase = ({
  title,
  items,
  onComplete,
}: {
  title: string;
  items: string[];
  onComplete: () => void;
}) => {
  const t = useT();
  const [checked, setChecked] = useState<number[]>([]);
  return (
    <div className="page" style={{ padding: "1rem 1rem 7rem" }}>
      <div className="section-label">{title}</div>
      <h1
        className="gradient-text display"
        style={{ fontSize: "3rem", marginBottom: "2rem" }}
      >
        PREPARE
      </h1>

      <div
        className="glass-card"
        style={{ padding: "1.5rem", marginBottom: "2rem" }}
      >
        {items.map((item, idx) => {
          const isChecked = checked.includes(idx);
          return (
            <div
              key={idx}
              onClick={() =>
                setChecked((c) =>
                  isChecked ? c.filter((i) => i !== idx) : [...c, idx],
                )
              }
              style={{
                display: "flex",
                gap: "1rem",
                alignItems: "center",
                padding: "0.75rem 0",
                borderBottom:
                  idx < items.length - 1
                    ? "1px solid rgba(0,240,255,0.1)"
                    : "none",
                cursor: "pointer",
                opacity: isChecked ? 0.5 : 1,
                transition: "var(--transition)",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: `2px solid ${isChecked ? "var(--cyan)" : "var(--color-text-muted)"}`,
                  background: isChecked ? "var(--cyan)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isChecked && <Check size={14} color="#000" />}
              </div>
              <span
                style={{
                  fontSize: "0.9rem",
                  textDecoration: isChecked ? "line-through" : "none",
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
      <button
        onClick={onComplete}
        className="btn-primary"
        style={{ width: "100%", padding: "1rem" }}
      >
        {t("workout.proceed")}{" "}
        <ChevronRight size={18} style={{ marginInlineStart: 4 }} />
      </button>
    </div>
  );
};

// ── Main Player ───────────────────────────────────────────────────────────────
const WorkoutPlayer = () => {
  const t = useT();
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const finishSession = useWorkoutStore((s) => s.finishSession);
  const setPhase = useWorkoutStore((s) => s.setPhase);
  const getProgressionSuggestion = useWorkoutStore(
    (s) => s.getProgressionSuggestion,
  );
  const swapExercise = useWorkoutStore((s) => s.swapExercise);
  const addXP = useGamificationStore((s) => s.addXP);
  const getAllExercises = useExerciseStore((s) => s.getAllExercises);
  const toggleFavorite = useExerciseStore((s) => s.toggleFavorite);
  const favorites = useExerciseStore((s) => s.favoriteExerciseIds);
  const injuries = useUserStore((s) => s.injuries);
  const lang = useLanguageStore((s) => s.lang);

  const [modalType, setModalType] = useState<
    "notes" | "swap" | "plate" | "history" | "create" | "add" | null
  >(null);
  const [clockNow, setClockNow] = useState(Date.now);
  const restEnd = activeSession?.restEndsAt;
  const restSecondsLeft = restEnd
    ? Math.max(0, Math.ceil((restEnd - clockNow) / 1000))
    : null;
  const [restTotalSeconds, setRestTotalSeconds] = useState(90);

  const [modalEx, setModalEx] = useState<
    (Exercise & { notes?: string }) | null
  >(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [slideKey, setSlideKey] = useState(0);
  const touchStartX = useRef(0);
  const removeExercise = useWorkoutStore((s) => s.removeExerciseFromSession);

  useEffect(() => {
    let wl: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((w) => {
          wl = w;
        })
        .catch(() => {});
    }
    return () => {
      if (wl) wl.release().catch(() => {});
    };
  }, []);

  // Rest-timer interval cleanup — must be declared unconditionally (before
  // the warmup/cooldown early returns below), otherwise this hook simply
  // isn't called on those phases, and React throws "Rendered more hooks
  // than during the previous render" the moment the phase changes.
  useEffect(() => {
    if (!restEnd) return;
    const timer = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [restEnd]);

  if (!activeSession) return null;

  const allEx = getAllExercises();
  const exCount = activeSession.exercises.length;
  const safeIdx = Math.min(activeExIdx, Math.max(0, exCount - 1));

  const goPrev = () => {
    if (safeIdx <= 0) return;
    setSlideDir("right");
    setSlideKey((k) => k + 1);
    setActiveExIdx(safeIdx - 1);
  };
  const goNext = () => {
    if (safeIdx >= exCount - 1) return;
    setSlideDir("left");
    setSlideKey((k) => k + 1);
    setActiveExIdx(safeIdx + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) goNext();
    else if (dx > 50) goPrev();
  };

  if (activeSession.phase === "warmup") {
    const items = [
      "Jumping jacks or light jog (2 min)",
      "Arm circles & torso twists (1 min)",
      "Dynamic mobility (10 reps)",
      "Empty bar / lightweight activation (2 sets x 15 reps)",
    ];
    return (
      <ChecklistPhase
        title={t("workout.warmup")}
        items={items}
        onComplete={() => setPhase("main")}
      />
    );
  }

  if (activeSession.phase === "cooldown") {
    const items = [
      "Static stretching trained muscles (30s each)",
      "Foam rolling or lacrosse ball massage",
      "5 Deep diaphragmatic breaths",
      "Hang from pullup bar (30s)",
    ];
    return (
      <ChecklistPhase
        title={t("workout.cooldown")}
        items={items}
        onComplete={() => {
          void finishSession().catch(() =>
            alert(
              "Could not save workout. Please retry. / تعذر الحفظ، حاول مرة أخرى",
            ),
          );
        }}
      />
    );
  }

  const handleComplete = (exId: string, setNum: number) => {
    const ex = activeSession.exercises.find((e) => e.exerciseId === exId);
    const set = ex?.sets.find((s) => s.setNumber === setNum);
    if (!set) return;
    const nowCompleted = !set.completed;
    updateSet(exId, setNum, { completed: nowCompleted });
    if (nowCompleted) {
      addXP(10 + (set.weight || 0) * 0.05);
      startRestTimer();
    }
  };

  // Rest timer between sets: starts automatically when a set is marked
  // complete. 90s default, 60s for isolation-style movements with lighter
  // typical loads (a reasonable heuristic since we don't track a per-
  // exercise rest preference).
  const startRestTimer = (seconds = 90) => {
    setRestTotalSeconds(seconds);
    setClockNow(Date.now());
    useWorkoutStore.getState().setRestEndsAt(Date.now() + seconds * 1000);
  };
  const addRestSeconds = (delta: number) => {
    if (restEnd)
      useWorkoutStore
        .getState()
        .setRestEndsAt(Math.max(Date.now(), restEnd + delta * 1000));
    setRestTotalSeconds((n) => Math.max(1, n + delta));
  };
  const skipRestTimer = () => useWorkoutStore.getState().setRestEndsAt(null);

  const getRpeLabel = (rpe: number) => {
    if (rpe === 10) return "Max";
    if (rpe === 9) return "1 Left";
    if (rpe === 8) return "2 Left";
    if (rpe === 7) return "3 Left";
    if (rpe === 6) return "4 Left";
    return "";
  };

  return (
    <>
      {modalType === "swap" && modalEx && (
        <SwapModal
          currentExId={modalEx.id}
          currentCategory={modalEx.category}
          currentMuscle={modalEx.muscleGroup}
          onClose={() => setModalType(null)}
        />
      )}
      {modalType === "notes" && modalEx && (
        <NotesModal
          exerciseId={modalEx.id}
          name={modalEx.name}
          initNotes={
            activeSession.exercises.find((e) => e.exerciseId === modalEx.id)
              ?.notes
          }
          onClose={() => setModalType(null)}
        />
      )}
      {modalType === "plate" && (
        <ModalWrapper onClose={() => setModalType(null)}>
          <PlateCalculator />
        </ModalWrapper>
      )}
      {modalType === "history" && modalEx && (
        <HistoryModal
          exerciseId={modalEx.id}
          name={modalEx.name}
          onClose={() => setModalType(null)}
        />
      )}
      {modalType === "create" && (
        <CustomExerciseManager onClose={() => setModalType(null)} />
      )}
      {modalType === "add" && (
        <AddExerciseModal onClose={() => setModalType(null)} />
      )}

      {restSecondsLeft !== null &&
        createPortal(
          <div
            style={{
              position: "fixed",
              bottom: "6rem",
              left: "1rem",
              right: "1rem",
              zIndex: 500,
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            <div
              className="glass-card"
              style={{
                padding: "0.85rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                border: "1px solid var(--cyan)",
                boxShadow: "var(--shadow-cyan)",
              }}
            >
              <Timer size={20} color="var(--cyan)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t("workout.rest_timer")}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: "var(--cyan)",
                  }}
                >
                  {Math.floor(restSecondsLeft / 60)}:
                  {(restSecondsLeft % 60).toString().padStart(2, "0")}
                </div>
                <div
                  style={{
                    height: 3,
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 2,
                    marginTop: "0.35rem",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(restSecondsLeft / restTotalSeconds) * 100}%`,
                      background: "var(--cyan)",
                      transition: "width 1s linear",
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => addRestSeconds(15)}
                style={{
                  padding: "0.4rem 0.6rem",
                  fontSize: "0.72rem",
                  color: "var(--cyan)",
                  border: "1px solid rgba(0,240,255,0.3)",
                  borderRadius: 8,
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                }}
              >
                +15s
              </button>
              <button
                onClick={skipRestTimer}
                aria-label={lang === "ar" ? "تخطي الراحة" : "Skip rest"}
                style={{ color: "var(--color-text-muted)", padding: "0.4rem" }}
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="page" style={{ padding: "1rem 1rem 7rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <div className="section-label">{t("workout.active_session")}</div>
            <h1 className="neon-cyan display" style={{ fontSize: "2.2rem" }}>
              {activeSession.type}
            </h1>
          </div>
          <CircularTimer defaultSeconds={120} />
        </div>

        <button
          onClick={() => setModalType("plate")}
          className="btn-secondary"
          style={{ width: "100%", marginBottom: "1.25rem", padding: "0.75rem" }}
        >
          {t("workout.open_calc")}
        </button>

        {/* Exercise navigation: prev / dots / next */}
        {exCount > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={goPrev}
              disabled={safeIdx === 0}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "1px solid rgba(0,240,255,0.2)",
                background: "rgba(0,240,255,0.06)",
                color:
                  safeIdx === 0 ? "var(--color-text-muted)" : "var(--cyan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: safeIdx === 0 ? "not-allowed" : "pointer",
                opacity: safeIdx === 0 ? 0.4 : 1,
              }}
            >
              <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
            </button>
            <div
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
                flex: 1,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {activeSession.exercises.map((exd, i) => {
                const done = exd.sets.every((s) => s.completed);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSlideDir(i > safeIdx ? "left" : "right");
                      setSlideKey((k) => k + 1);
                      setActiveExIdx(i);
                    }}
                    style={{
                      width: i === safeIdx ? 24 : 8,
                      height: 8,
                      borderRadius: 4,
                      background: done
                        ? "var(--color-success)"
                        : i === safeIdx
                          ? "var(--cyan)"
                          : "rgba(0,240,255,0.2)",
                      transition: "all 0.3s",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>
            <button
              onClick={goNext}
              disabled={safeIdx >= exCount - 1}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "1px solid rgba(0,240,255,0.2)",
                background: "rgba(0,240,255,0.06)",
                color:
                  safeIdx >= exCount - 1
                    ? "var(--color-text-muted)"
                    : "var(--cyan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: safeIdx >= exCount - 1 ? "not-allowed" : "pointer",
                opacity: safeIdx >= exCount - 1 ? 0.4 : 1,
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Active exercise — focused card with swipe support */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ overflow: "hidden" }}
        >
          {activeSession.exercises.map((ex, idx) => {
            if (idx !== safeIdx) return null;
            const def = allEx.find((e) => e.id === ex.exerciseId) || allEx[0];
            const isCollapsed = collapsed[ex.exerciseId];
            const completedSets = ex.sets.filter((s) => s.completed).length;
            const exName =
              useLanguageStore.getState().lang === "ar" && def.nameAr
                ? def.nameAr
                : def.name;
            const slideClass =
              slideDir === "left"
                ? "exercise-slide-in-left"
                : "exercise-slide-in-right";
            return (
              <div
                key={`${ex.exerciseId}-${slideKey}`}
                className={`glass-card ${slideClass}`}
                style={{ marginBottom: "1rem" }}
              >
                <div
                  style={{
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: isCollapsed
                      ? "none"
                      : "1px solid rgba(0,240,255,0.08)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontWeight: 700,
                          fontSize: "1rem",
                        }}
                      >
                        {exName}
                      </span>
                      {def.isRehab && <span className="tag-rehab">REHAB</span>}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                        marginTop: "0.2rem",
                      }}
                    >
                      {completedSets}/{ex.sets.length} sets · Ex {safeIdx + 1}/
                      {exCount}
                    </div>
                  </div>
                  <div className="workout-tools">
                    {def.videoUrl && (
                      <a
                        href={def.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--magenta)",
                          padding: "0.4rem",
                          display: "flex",
                        }}
                      >
                        <Film size={16} />
                      </a>
                    )}
                    <button
                      onClick={() => toggleFavorite(def.id)}
                      style={{
                        color: favorites.includes(def.id)
                          ? "var(--gold)"
                          : "var(--color-text-muted)",
                        padding: "0.4rem",
                      }}
                    >
                      <Star
                        size={16}
                        fill={
                          favorites.includes(def.id) ? "var(--gold)" : "none"
                        }
                      />
                    </button>
                    <button
                      onClick={() => {
                        setModalEx(def);
                        setModalType("history");
                      }}
                      style={{
                        color: "var(--color-text-muted)",
                        padding: "0.4rem",
                      }}
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setModalEx(def);
                        setModalType("swap");
                      }}
                      style={{ color: "var(--cyan)", padding: "0.4rem" }}
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setModalEx(def);
                        setModalType("notes");
                      }}
                      style={{
                        color: "var(--color-text-muted)",
                        padding: "0.4rem",
                      }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => removeExercise(ex.exerciseId)}
                      style={{ color: "var(--magenta)", padding: "0.4rem" }}
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setCollapsed((c) => ({
                          ...c,
                          [ex.exerciseId]: !c[ex.exerciseId],
                        }))
                      }
                      style={{
                        color: "var(--color-text-muted)",
                        padding: "0.4rem",
                      }}
                    >
                      {isCollapsed ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronUp size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {(() => {
                  const suggestion = getProgressionSuggestion(ex.exerciseId);
                  if (!suggestion) return null;
                  return (
                    <div
                      style={{
                        margin: "0.6rem 1rem 0",
                        padding: "0.5rem 0.75rem",
                        background: "rgba(255,170,0,0.08)",
                        border: "1px solid rgba(255,170,0,0.25)",
                        borderRadius: 8,
                        fontSize: "0.75rem",
                        color: "var(--gold)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <TrendingUp size={13} style={{ flexShrink: 0 }} />
                      <span>
                        Try {suggestion.weight}kg — {suggestion.reason}
                      </span>
                    </div>
                  );
                })()}

                {(() => {
                  const activeInjuries = injuries.filter(
                    (i) => i.status === "Active",
                  );
                  if (activeInjuries.length === 0) return null;
                  const riskEntry = INJURY_RISK_MAP.find(
                    (entry) =>
                      entry.riskyExerciseIds.includes(ex.exerciseId) &&
                      activeInjuries.some((inj) =>
                        entry.keywords.some((kw) =>
                          inj.bodyPart.toLowerCase().includes(kw),
                        ),
                      ),
                  );
                  if (!riskEntry) return null;
                  const altDef = allEx.find(
                    (e) => e.id === riskEntry.saferAlternativeId,
                  );
                  return (
                    <div
                      style={{
                        margin: "0.6rem 1rem 0",
                        padding: "0.6rem 0.75rem",
                        background: "rgba(255,0,85,0.08)",
                        border: "1px solid rgba(255,0,85,0.3)",
                        borderRadius: 8,
                        fontSize: "0.75rem",
                        color: "var(--magenta)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginBottom: "0.3rem",
                          fontWeight: 700,
                        }}
                      >
                        <ShieldAlert size={13} style={{ flexShrink: 0 }} />
                        <span>{t("workout.injury_risk_title")}</span>
                      </div>
                      <div
                        style={{
                          color: "var(--color-text-muted)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {lang === "ar" ? riskEntry.noteAr : riskEntry.note}
                      </div>
                      {altDef && (
                        <button
                          onClick={() =>
                            swapExercise(
                              ex.exerciseId,
                              riskEntry.saferAlternativeId,
                            )
                          }
                          style={{
                            padding: "0.35rem 0.65rem",
                            fontSize: "0.72rem",
                            color: "var(--magenta)",
                            border: "1px solid rgba(255,0,85,0.4)",
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        >
                          {t("workout.swap_to")}{" "}
                          {lang === "ar" && altDef.nameAr
                            ? altDef.nameAr
                            : altDef.name}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {!isCollapsed && (
                  <div style={{ padding: "0.5rem 1rem 1rem" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "30px 1fr 1fr 1fr 40px",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                        fontSize: "0.65rem",
                        color: "var(--color-text-muted)",
                        textAlign: "center",
                      }}
                    >
                      <div>SET</div>
                      <div>KG</div>
                      <div>REPS</div>
                      <div>RPE</div>
                      <div></div>
                    </div>
                    {ex.sets.map((set) => (
                      <div key={set.setNumber} className="set-row">
                        <div
                          style={{
                            textAlign: "center",
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.85rem",
                          }}
                        >
                          {set.setNumber}
                        </div>
                        <input
                          aria-label={`Set ${set.setNumber} weight`}
                          inputMode="decimal"
                          min="0"
                          max="2000"
                          type="number"
                          value={set.weight || ""}
                          onChange={(e) =>
                            updateSet(ex.exerciseId, set.setNumber, {
                              weight: parseFloat(e.target.value) || 0,
                            })
                          }
                          style={{ textAlign: "center" }}
                        />
                        <input
                          aria-label={`Set ${set.setNumber} reps`}
                          inputMode="numeric"
                          min="0"
                          max="10000"
                          type="number"
                          value={set.reps || ""}
                          onChange={(e) =>
                            updateSet(ex.exerciseId, set.setNumber, {
                              reps: parseFloat(e.target.value) || 0,
                            })
                          }
                          style={{ textAlign: "center" }}
                        />
                        <div style={{ position: "relative" }}>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={set.rpe || ""}
                            onChange={(e) =>
                              updateSet(ex.exerciseId, set.setNumber, {
                                rpe: parseFloat(e.target.value) || 0,
                              })
                            }
                            style={{ textAlign: "center", width: "100%" }}
                          />
                          {set.rpe >= 6 && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: -12,
                                insetInlineStart: 0,
                                insetInlineEnd: 0,
                                textAlign: "center",
                                fontSize: "0.5rem",
                                color: "var(--magenta)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getRpeLabel(set.rpe)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleComplete(ex.exerciseId, set.setNumber)
                          }
                          style={{
                            height: 40,
                            borderRadius: "var(--radius-md)",
                            background: set.completed
                              ? "var(--color-success)"
                              : "rgba(0,240,255,0.08)",
                            border: `1px solid ${set.completed ? "var(--color-success)" : "rgba(0,240,255,0.2)"}`,
                            color: set.completed ? "#000" : "var(--cyan)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                    {ex.notes && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-text-muted)",
                          background: "rgba(255,255,255,0.05)",
                          padding: "0.5rem",
                          borderRadius: "4px",
                          marginTop: "0.5rem",
                        }}
                      >
                        <strong>{t("workout.notes")}:</strong> {ex.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All exercises mini-list (collapsed overview) */}
        {exCount > 1 && (
          <div style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
            <div className="section-label" style={{ marginBottom: "0.5rem" }}>
              All Exercises
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              {activeSession.exercises.map((ex, i) => {
                const def =
                  allEx.find((e) => e.id === ex.exerciseId) || allEx[0];
                const done = ex.sets.every((s) => s.completed);
                const exName =
                  useLanguageStore.getState().lang === "ar" && def.nameAr
                    ? def.nameAr
                    : def.name;
                return (
                  <button
                    key={ex.exerciseId}
                    onClick={() => {
                      setSlideDir(i > safeIdx ? "left" : "right");
                      setSlideKey((k) => k + 1);
                      setActiveExIdx(i);
                    }}
                    style={{
                      textAlign: "start",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      background:
                        i === safeIdx
                          ? "rgba(0,240,255,0.1)"
                          : "rgba(255,255,255,0.02)",
                      border: `1px solid ${i === safeIdx ? "rgba(0,240,255,0.3)" : "rgba(255,255,255,0.05)"}`,
                      color:
                        i === safeIdx
                          ? "var(--cyan)"
                          : done
                            ? "var(--color-success)"
                            : "var(--color-text-muted)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      {i + 1}. {exName}
                    </span>
                    {done && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setModalType("add")}
          className="btn-secondary"
          style={{
            width: "100%",
            padding: "1rem",
            marginTop: "1rem",
            borderStyle: "dashed",
          }}
        >
          + {t("workout.add_exercise") || "Add Exercise"}
        </button>

        <button
          onClick={() => setPhase("cooldown")}
          className="btn-primary"
          style={{ width: "100%", padding: "1rem", marginTop: "1rem" }}
        >
          {t("workout.finish_main")}
        </button>
      </div>
    </>
  );
};

// ── Session Selector ──────────────────────────────────────────────────────────
const Workout = () => {
  const t = useT();
  const ar = useLanguageStore((s) => s.lang === "ar");
  const restored = useWorkoutStore((s) => s.restored);
  const saveError = useWorkoutStore((s) => s.saveError);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const startSession = useWorkoutStore((s) => s.startSession);
  const scheduledSessions = useWorkoutStore((s) => s.scheduledSessions);
  const removeScheduledSession = useWorkoutStore(
    (s) => s.removeScheduledSession,
  );
  const getAllTemplates = useExerciseStore((s) => s.getAllTemplates);
  const getSplitSystems = useExerciseStore((s) => s.getSplitSystems);
  const getExerciseIdsForDay = useExerciseStore((s) => s.getExerciseIdsForDay);
  const history = useWorkoutStore((s) => s.history);
  const updateHistoricalSession = useWorkoutStore(
    (s) => s.updateHistoricalSession,
  );
  const getAllExercises = useExerciseStore((s) => s.getAllExercises);
  const [modalType, setModalType] = useState<"create" | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<
    Record<string, boolean>
  >({});
  const [activeSystemId, setActiveSystemId] = useState<SplitSystemId>("ppl");

  if (activeSession && restored)
    return (
      <div className="page">
        <h1>{ar ? "تمرينك محفوظ" : "Your workout is saved"}</h1>
        <p>{activeSession.type}</p>
        <button
          className="btn-primary"
          onClick={() => useWorkoutStore.getState().resumeSession()}
        >
          {ar ? "استكمال" : "Resume workout"}
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            if (
              confirm(
                ar
                  ? "حذف التمرين غير المكتمل؟"
                  : "Discard this unfinished workout?",
              )
            )
              void useWorkoutStore.getState().discardSession();
          }}
        >
          {ar ? "حذف" : "Discard"}
        </button>
      </div>
    );
  if (activeSession)
    return (
      <>
        {saveError && (
          <p role="alert">
            {ar
              ? "تعذر الحفظ. حاول مرة أخرى."
              : "Could not save. Please retry."}
          </p>
        )}
        <WorkoutPlayer />
      </>
    );

  const schedules = getAllTemplates();
  const allEx = getAllExercises();
  const splitSystems = getSplitSystems();
  const activeSystem =
    splitSystems.find((s) => s.id === activeSystemId) || splitSystems[0];

  const today = new Date();
  const dStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
  const todaysPlans = scheduledSessions.filter(
    (s) => s.date === dStr && !s.completedSessionId,
  );

  return (
    <div className="page" style={{ paddingBottom: "7rem" }}>
      {modalType === "create" && (
        <CustomExerciseManager onClose={() => setModalType(null)} />
      )}
      <header
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div className="section-label">{t("workout.programs")}</div>
          <h1 className="display" style={{ fontSize: "2.5rem" }}>
            {t("workout.title")}{" "}
            <span className="neon-cyan">{t("workout.session")}</span>
          </h1>
        </div>
        <button
          onClick={() => setModalType("create")}
          className="btn-secondary"
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.75rem",
            borderRadius: "var(--radius-full)",
          }}
        >
          <Plus size={14} style={{ marginInlineEnd: 4 }} /> Custom Ex
        </button>
      </header>

      {todaysPlans.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "1rem",
              color: "var(--gold)",
            }}
          >
            {t("calendar.todays_plan") || "Today's Plan"}
          </h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            {todaysPlans.map((plan) => (
              <div
                key={plan.id}
                className="glass-card animate-fade-up"
                style={{
                  padding: "1.25rem",
                  borderLeft: "3px solid var(--gold)",
                  background: "rgba(255, 215, 0, 0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                      }}
                    >
                      {plan.type}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {plan.exerciseIds.length} {t("workout.exercises")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => removeScheduledSession(plan.id)}
                      style={{
                        color: "var(--magenta)",
                        padding: "0.5rem",
                        background: "rgba(255, 0, 85, 0.1)",
                        borderRadius: "8px",
                      }}
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() =>
                        startSession(plan.type, plan.exerciseIds, plan.id)
                      }
                      className="btn-primary"
                      style={{
                        padding: "0.6rem 1.1rem",
                        fontSize: "0.85rem",
                        background: "var(--gold)",
                        color: "#000",
                        borderColor: "var(--gold)",
                      }}
                    >
                      <Play size={16} /> {t("workout.start")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split System Selector */}
      <div
        data-walkthrough="split-systems"
        className="stagger"
        style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.25rem",
            fontWeight: 700,
            margin: "1rem 0 0.5rem 0",
          }}
        >
          Split Systems
        </h2>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            paddingBottom: "0.25rem",
          }}
        >
          {splitSystems.map((sys) => (
            <button
              key={sys.id}
              onClick={() => setActiveSystemId(sys.id)}
              className={
                sys.id === activeSystemId ? "btn-primary" : "btn-secondary"
              }
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
                borderRadius: "var(--radius-full)",
                flexShrink: 0,
                // btn-secondary's cyan text/border can blend into this page's
                // bright cyan header gradient — force a dark backing so the
                // inactive tabs stay legible no matter what's behind them.
                background:
                  sys.id === activeSystemId ? undefined : "rgba(2,4,8,0.55)",
              }}
            >
              {sys.name}
            </button>
          ))}
        </div>
        {activeSystem?.description && (
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {activeSystem.description}
          </div>
        )}

        {activeSystem?.id === "custom" && activeSystem.days.length === 0 ? (
          <div
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.85rem",
              background: "rgba(255,255,255,0.02)",
              padding: "1.5rem",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            {t("workout.no_custom_splits")}
          </div>
        ) : (
          (activeSystem?.days || []).map((day) => {
            const exerciseIds = getExerciseIdsForDay(activeSystem.id, day.key);
            return (
              <div
                key={day.key}
                className="glass-card animate-fade-up"
                style={{
                  padding: "1.25rem",
                  borderLeft: "3px solid var(--cyan)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                      }}
                    >
                      {day.label}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {exerciseIds.length} {t("workout.exercises")}
                    </div>
                  </div>
                  <button
                    onClick={() => startSession(day.label, exerciseIds)}
                    className="btn-primary"
                    style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }}
                    disabled={exerciseIds.length === 0}
                  >
                    <Play size={16} /> {t("workout.start")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <details className="program-library">
        <summary>
          <span>
            <strong>All Programs</strong>
            <small>{Object.keys(schedules).length} ready-made sessions</small>
          </span>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="program-library__list">
          {Object.entries(schedules).map(([name, exerciseIds]) => (
            <div key={name} className="program-library__row">
              <div>
                <strong>{name}</strong>
                <small>
                  {exerciseIds.length} {t("workout.exercises")}
                </small>
              </div>
              <button
                onClick={() => startSession(name, exerciseIds)}
                className="btn-secondary"
              >
                <Play size={16} /> {t("workout.start")}
              </button>
            </div>
          ))}
        </div>
      </details>

      {/* Historical Sessions Section */}
      <div
        className="stagger"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          marginTop: "2.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.25rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <History size={18} className="neon-magenta" />
          {t("workout.training_log_heading")}
        </h2>

        {history.length === 0 ? (
          <div
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.85rem",
              background: "rgba(255,255,255,0.02)",
              padding: "1.5rem",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            {t("workout.no_history_yet")}
          </div>
        ) : (
          [...history].reverse().map((session) => (
            <div
              key={session.sessionId}
              className="glass-card animate-fade-up"
              style={{
                padding: "1.25rem",
                borderInlineStart: "3px solid var(--signal-muted)",
                background: "var(--ink-raised)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h4
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      margin: 0,
                      color: "#fff",
                    }}
                  >
                    {session.type}
                  </h4>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                      marginTop: "0.25rem",
                    }}
                  >
                    {format(new Date(session.date), "eeee, MMMM d, yyyy")} •{" "}
                    {t("workout.total_volume_label")}:{" "}
                    <span className="neon-magenta" style={{ fontWeight: 700 }}>
                      {session.totalVolume.toLocaleString()}{" "}
                      {t("workout.kg_unit")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setExpandedHistory((e) => ({
                      ...e,
                      [session.sessionId]: !e[session.sessionId],
                    }))
                  }
                  className="btn-secondary"
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.75rem",
                    borderRadius: 8,
                  }}
                >
                  {expandedHistory[session.sessionId]
                    ? t("workout.hide_details")
                    : t("workout.view_and_edit")}
                </button>
              </div>

              {/* Collapsible exercises list */}
              {expandedHistory[session.sessionId] && (
                <div
                  style={{
                    marginTop: "1.25rem",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    paddingTop: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                  }}
                >
                  {session.exercises.map((ex) => {
                    const def = allEx.find((e) => e.id === ex.exerciseId);
                    const exName =
                      useLanguageStore.getState().lang === "ar" && def?.nameAr
                        ? def.nameAr
                        : def?.name || ex.exerciseId;
                    return (
                      <div
                        key={ex.exerciseId}
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          padding: "0.85rem",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            marginBottom: "0.65rem",
                            color: "var(--cyan)",
                          }}
                        >
                          {exName}
                        </div>

                        {/* Sets detail */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "50px 1fr 1fr 1fr",
                            gap: "0.5rem",
                            textAlign: "center",
                            fontSize: "0.68rem",
                            color: "var(--color-text-muted)",
                            marginBottom: "0.4rem",
                            fontWeight: 600,
                          }}
                        >
                          <div>{t("workout.col_set")}</div>
                          <div>{t("workout.col_weight_kg")}</div>
                          <div>{t("workout.col_reps")}</div>
                          <div>RPE</div>
                        </div>
                        {ex.sets.map((set, sIdx) => (
                          <div
                            key={sIdx}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "50px 1fr 1fr 1fr",
                              gap: "0.5rem",
                              alignItems: "center",
                              marginBottom: "0.4rem",
                            }}
                          >
                            <div
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.85rem",
                                textAlign: "center",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              {set.setNumber}
                            </div>
                            <input
                              type="number"
                              value={set.weight || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const updatedExercises = session.exercises.map(
                                  (we) => {
                                    if (we.exerciseId !== ex.exerciseId)
                                      return we;
                                    const updatedSets = we.sets.map((ws) =>
                                      ws.setNumber === set.setNumber
                                        ? { ...ws, weight: val }
                                        : ws,
                                    );
                                    return { ...we, sets: updatedSets };
                                  },
                                );
                                // Recalculate volume
                                const newVolume = updatedExercises.reduce(
                                  (sum, we) => {
                                    return (
                                      sum +
                                      we.sets
                                        .filter((s) => s.completed)
                                        .reduce(
                                          (sSum, s) => sSum + s.weight * s.reps,
                                          0,
                                        )
                                    );
                                  },
                                  0,
                                );
                                updateHistoricalSession(session.sessionId, {
                                  exercises: updatedExercises,
                                  totalVolume: newVolume,
                                });
                              }}
                              style={{
                                padding: "0.35rem",
                                fontSize: "0.85rem",
                                textAlign: "center",
                                background: "rgba(0,0,0,0.4)",
                                border: "1px solid rgba(0,240,255,0.15)",
                                color: "#fff",
                                borderRadius: 6,
                              }}
                            />
                            <input
                              type="number"
                              value={set.reps || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const updatedExercises = session.exercises.map(
                                  (we) => {
                                    if (we.exerciseId !== ex.exerciseId)
                                      return we;
                                    const updatedSets = we.sets.map((ws) =>
                                      ws.setNumber === set.setNumber
                                        ? { ...ws, reps: val }
                                        : ws,
                                    );
                                    return { ...we, sets: updatedSets };
                                  },
                                );
                                // Recalculate volume
                                const newVolume = updatedExercises.reduce(
                                  (sum, we) => {
                                    return (
                                      sum +
                                      we.sets
                                        .filter((s) => s.completed)
                                        .reduce(
                                          (sSum, s) => sSum + s.weight * s.reps,
                                          0,
                                        )
                                    );
                                  },
                                  0,
                                );
                                updateHistoricalSession(session.sessionId, {
                                  exercises: updatedExercises,
                                  totalVolume: newVolume,
                                });
                              }}
                              style={{
                                padding: "0.35rem",
                                fontSize: "0.85rem",
                                textAlign: "center",
                                background: "rgba(0,0,0,0.4)",
                                border: "1px solid rgba(0,240,255,0.15)",
                                color: "#fff",
                                borderRadius: 6,
                              }}
                            />
                            <input
                              type="number"
                              value={set.rpe || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const updatedExercises = session.exercises.map(
                                  (we) => {
                                    if (we.exerciseId !== ex.exerciseId)
                                      return we;
                                    const updatedSets = we.sets.map((ws) =>
                                      ws.setNumber === set.setNumber
                                        ? { ...ws, rpe: val }
                                        : ws,
                                    );
                                    return { ...we, sets: updatedSets };
                                  },
                                );
                                updateHistoricalSession(session.sessionId, {
                                  exercises: updatedExercises,
                                });
                              }}
                              style={{
                                padding: "0.35rem",
                                fontSize: "0.85rem",
                                textAlign: "center",
                                background: "rgba(0,0,0,0.4)",
                                border: "1px solid rgba(0,240,255,0.15)",
                                color: "#fff",
                                borderRadius: 6,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Workout;
