import { create } from "zustand";
import { subDays } from "date-fns";
import db from "../db/db";
import { useUserStore } from "./useUserStore";
import { useGamificationStore } from "./useGamificationStore";
import { EXERCISE_DATABASE } from "../data/exercises";

export interface WorkoutSet {
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number;
  completed: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes: string;
  voiceNotes: string[];
}

export interface WorkoutSession {
  scheduledId?: string;
  finishedAt?: number;
  restEndsAt?: number | null;
  sessionId: string;
  date: number; // timestamp
  type: string; // e.g. "Push A"
  exercises: WorkoutExercise[];
  totalVolume: number;
  phase: "warmup" | "main" | "cooldown";
  isFinished: boolean;
}

export interface ScheduledSession {
  completedSessionId?: string;
  id: string;
  date: string; // YYYY-MM-DD
  type: string; // e.g. "Push A"
  exerciseIds: string[];
}

interface WorkoutState {
  restored: boolean;
  saving: boolean;
  saveError: string | null;
  resumeSession: () => void;
  discardSession: () => Promise<void>;
  setRestEndsAt: (at: number | null) => void;
  history: WorkoutSession[];
  activeSession: WorkoutSession | null;
  scheduledSessions: ScheduledSession[];
  suggestDeload: boolean;
  volumeSpikeWarning: boolean;
  loadUserWorkouts: (userId: string) => Promise<void>;
  startSession: (
    type: string,
    exerciseIds: string[],
    scheduledId?: string,
  ) => void;
  updateSet: (
    exerciseId: string,
    setNumber: number,
    data: Partial<WorkoutSet>,
  ) => void;
  updateNotes: (exerciseId: string, notes: string) => void;
  addVoiceNote: (exerciseId: string, voiceNote: string) => void;
  swapExercise: (oldId: string, newId: string) => void;
  addExerciseToSession: (exerciseId: string) => void;
  removeExerciseFromSession: (exerciseId: string) => void;
  setPhase: (phase: "warmup" | "main" | "cooldown") => void;
  finishSession: () => Promise<void>;
  getSuggestedWeight: (exerciseId: string) => number;
  getProgressionSuggestion: (
    exerciseId: string,
  ) => { weight: number; reason: string } | null;
  getPersonalRecords: () => Record<
    string,
    { bestWeight: number; bestReps: number; est1RM: number; date: number }
  >;
  scheduleSession: (date: string, type: string, exerciseIds: string[]) => void;
  removeScheduledSession: (id: string) => void;
  updateScheduledSessionDate: (id: string, newDate: string) => void;
  updateHistoricalSession: (
    sessionId: string,
    updatedSession: Partial<WorkoutSession>,
  ) => Promise<void>;
}

const generateId = () => crypto.randomUUID();
let writes: Promise<void> = Promise.resolve();
let hydrating = false;
let finishing = false;
export async function flushWorkoutWrites() {
  await writes;
}

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  restored: false,
  saving: false,
  saveError: null,
  resumeSession: () => set({ restored: false }),
  discardSession: async () => {
    await flushWorkoutWrites();
    const userId = useUserStore.getState().activeUserId;
    if (!userId) return;
    await db.active_workouts.delete(userId);
    set({ activeSession: null, restored: false });
  },
  setRestEndsAt: (restEndsAt) =>
    set((s) =>
      s.activeSession && !finishing
        ? { activeSession: { ...s.activeSession, restEndsAt } }
        : {},
    ),
  history: [],
  activeSession: null,
  scheduledSessions: [],
  suggestDeload: false,
  volumeSpikeWarning: false,

  loadUserWorkouts: async (userId: string) => {
    await flushWorkoutWrites();
    const [workouts, active, schedules] = await Promise.all([
      db.workouts.where("userId").equals(userId).sortBy("date"),
      db.active_workouts.get(userId),
      db.schedules.where("userId").equals(userId).sortBy("date"),
    ]);
    hydrating = true;
    set({
      history: workouts,
      activeSession: active?.session || null,
      scheduledSessions: schedules,
      restored: !!active,
      saveError: null,
    });
    hydrating = false;
  },

  scheduleSession: (date, type, exerciseIds) =>
    set((state) => ({
      scheduledSessions: [
        ...state.scheduledSessions,
        { id: generateId(), date, type, exerciseIds },
      ],
    })),

  removeScheduledSession: (id) =>
    set((state) => ({
      scheduledSessions: state.scheduledSessions.filter((s) => s.id !== id),
    })),

  updateScheduledSessionDate: (id, newDate) =>
    set((state) => ({
      scheduledSessions: state.scheduledSessions.map((s) =>
        s.id === id ? { ...s, date: newDate } : s,
      ),
    })),

  startSession: (type, exerciseIds, scheduledId) => {
    if (get().activeSession || finishing) return;
    const plan = scheduledId
      ? get().scheduledSessions.find((s) => s.id === scheduledId)
      : undefined;
    if (scheduledId && (!plan || plan.completedSessionId)) return;
    const exercises: WorkoutExercise[] = (plan?.exerciseIds || exerciseIds).map(
      (id) => {
        // Find suggested weight from history
        const suggestedWeight = get().getSuggestedWeight(id);
        return {
          exerciseId: id,
          notes: "",
          voiceNotes: [],
          sets: [
            {
              setNumber: 1,
              weight: suggestedWeight,
              reps: 0,
              rpe: 0,
              completed: false,
            },
            {
              setNumber: 2,
              weight: suggestedWeight,
              reps: 0,
              rpe: 0,
              completed: false,
            },
            {
              setNumber: 3,
              weight: suggestedWeight,
              reps: 0,
              rpe: 0,
              completed: false,
            },
          ],
        };
      },
    );

    set({
      activeSession: {
        sessionId: generateId(),
        scheduledId,
        date: Date.now(),
        type: plan?.type || type,
        exercises,
        totalVolume: 0,
        phase: "warmup",
        isFinished: false,
      },
    });
  },

  updateSet: (exerciseId, setNumber, data) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      for (const [key, max] of [
        ["weight", 2000],
        ["reps", 10000],
        ["rpe", 10],
      ] as const)
        if (
          data[key] !== undefined &&
          (!Number.isFinite(data[key]) || data[key]! < 0 || data[key]! > max)
        )
          return state;
      const exercises = state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const sets = ex.sets.map((s) => {
          if (s.setNumber !== setNumber) return s;
          return { ...s, ...data };
        });
        return { ...ex, sets };
      });
      return { activeSession: { ...state.activeSession, exercises } };
    }),

  updateNotes: (exerciseId, notes) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      const exercises = state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        return { ...ex, notes };
      });
      return { activeSession: { ...state.activeSession, exercises } };
    }),

  addVoiceNote: (exerciseId, voiceNote) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      const exercises = state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        return { ...ex, voiceNotes: [...ex.voiceNotes, voiceNote] };
      });
      return { activeSession: { ...state.activeSession, exercises } };
    }),

  swapExercise: (oldId, newId) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      const exercises = state.activeSession.exercises.map((ex) => {
        if (ex.exerciseId !== oldId) return ex;
        return { ...ex, exerciseId: newId }; // keep sets and notes, just swap ID
      });
      return { activeSession: { ...state.activeSession, exercises } };
    }),

  addExerciseToSession: (exerciseId) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      const suggestedWeight = get().getSuggestedWeight(exerciseId);
      const newExercise = {
        exerciseId,
        notes: "",
        voiceNotes: [],
        sets: [
          {
            setNumber: 1,
            weight: suggestedWeight,
            reps: 0,
            rpe: 0,
            completed: false,
          },
          {
            setNumber: 2,
            weight: suggestedWeight,
            reps: 0,
            rpe: 0,
            completed: false,
          },
          {
            setNumber: 3,
            weight: suggestedWeight,
            reps: 0,
            rpe: 0,
            completed: false,
          },
        ],
      };
      return {
        activeSession: {
          ...state.activeSession,
          exercises: [...state.activeSession.exercises, newExercise],
        },
      };
    }),

  removeExerciseFromSession: (exerciseId) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      const exercises = state.activeSession.exercises.filter(
        (ex) => ex.exerciseId !== exerciseId,
      );
      return { activeSession: { ...state.activeSession, exercises } };
    }),

  setPhase: (phase) =>
    set((state) => {
      if (!state.activeSession || finishing) return state;
      return { activeSession: { ...state.activeSession, phase } };
    }),

  finishSession: async () => {
    if (finishing) return;
    const state = get();
    if (!state.activeSession) return;
    finishing = true;
    try {
      await flushWorkoutWrites();

      let totalVolume = 0;
      let setsCompleted = 0;
      state.activeSession.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          if (s.completed && s.weight > 0 && s.reps > 0) {
            totalVolume += s.weight * s.reps;
            setsCompleted += 1;
          }
        });
      });

      const finishedSession = {
        ...state.activeSession,
        isFinished: true,
        finishedAt: Date.now(),
        restEndsAt: null,
        totalVolume,
      };

      const userId = useUserStore.getState().activeUserId;
      if (!userId) throw new Error("No active profile");
      await db.transaction(
        "rw",
        [db.workouts, db.active_workouts, db.schedules],
        async () => {
          await db.workouts.put({ ...finishedSession, userId });
          if (finishedSession.scheduledId) {
            const plan = await db.schedules.get(finishedSession.scheduledId);
            if (plan?.userId === userId)
              await db.schedules.update(plan.id, {
                completedSessionId: finishedSession.sessionId,
              });
          }
          await db.active_workouts.delete(userId);
        },
      );
      const newHistory = [...state.history, finishedSession].sort(
        (a, b) => a.date - b.date,
      );

      // Gamification integration
      const gamification = useGamificationStore.getState();
      gamification.addXP(totalVolume * 0.1 + setsCompleted * 10);
      gamification.unlockBadge("first_workout");

      // Use the session's actual start time, not "now" (finish time may cross
      // an hour boundary the session didn't start in).
      const sessionHour = new Date(finishedSession.date).getHours();
      const earlySessions = newHistory.filter(
        (s) => new Date(s.date).getHours() < 8,
      ).length;
      const lateSessions = newHistory.filter(
        (s) => new Date(s.date).getHours() >= 20,
      ).length;
      if (sessionHour < 8 && earlySessions >= 10)
        gamification.unlockBadge("early_bird");
      if (sessionHour >= 20 && lateSessions >= 10)
        gamification.unlockBadge("night_owl");

      // Consecutive-day training streak (calendar days with at least one session)
      const trainingDays = Array.from(
        new Set(
          newHistory.map((s) => {
            const d = new Date(s.date);
            return new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate(),
            ).getTime();
          }),
        ),
      ).sort((a, b) => b - a);
      let streak = 0;
      let cursor = trainingDays[0];
      for (const day of trainingDays) {
        if (day === cursor) {
          streak++;
          cursor = subDays(new Date(cursor), 1).getTime();
        } else break;
      }
      if (streak >= 7) gamification.unlockBadge("streak_7");
      if (streak >= 30) gamification.unlockBadge("streak_30");

      // 100kg Bench Press: any completed set on a bench-press exercise at >=100kg
      const BENCH_IDS = ["bench_press"];
      const hitBench100 = finishedSession.exercises.some(
        (ex) =>
          BENCH_IDS.includes(ex.exerciseId) &&
          ex.sets.some((s) => s.completed && s.weight >= 100),
      );
      if (hitBench100) gamification.unlockBadge("bench_100");

      // Category lookup for the remaining badges (Neck / Hand-Grip / Face exercises)
      const categoryOf = (exerciseId: string) =>
        EXERCISE_DATABASE.find((e) => e.id === exerciseId)?.category;

      // Face Gains: 30 distinct days with a completed 'Face' category exercise
      const faceDays = new Set(
        newHistory
          .filter((s) =>
            s.exercises.some(
              (ex) =>
                categoryOf(ex.exerciseId) === "Face" &&
                ex.sets.some((st) => st.completed),
            ),
          )
          .map((s) => {
            const d = new Date(s.date);
            return new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate(),
            ).getTime();
          }),
      );
      if (faceDays.size >= 30) gamification.unlockBadge("face_gains");

      // Grip Master: +10kg improvement on any 'Hand/Grip' category exercise
      // (compares the earliest vs the best completed-set weight across history)
      const gripExerciseIds = new Set(
        newHistory.flatMap((s) =>
          s.exercises
            .filter((ex) => categoryOf(ex.exerciseId) === "Hand/Grip")
            .map((ex) => ex.exerciseId),
        ),
      );
      const gripImproved = Array.from(gripExerciseIds).some((exId) => {
        const weights = newHistory
          .flatMap((s) => s.exercises.filter((ex) => ex.exerciseId === exId))
          .flatMap((ex) =>
            ex.sets.filter((st) => st.completed).map((st) => st.weight),
          )
          .filter((w) => w > 0);
        if (weights.length < 2) return false;
        return Math.max(...weights) - weights[0] >= 10;
      });
      if (gripImproved) gamification.unlockBadge("grip_master");

      // Neck-related badges use the user's logged neck injuries as a proxy for
      // "pain spikes" — no dedicated pain-event tracker exists yet.
      const neckInjuries = useUserStore
        .getState()
        .injuries.filter((i) => i.bodyPart.toLowerCase().includes("neck"));
      const neckSessions = newHistory.filter((s) =>
        s.exercises.some(
          (ex) =>
            categoryOf(ex.exerciseId) === "Neck" &&
            ex.sets.some((st) => st.completed),
        ),
      );

      // Neck Pain Free Week: 7 consecutive calendar days of neck training,
      // ending TODAY (not a stale streak from weeks ago), with no neck injury
      // logged in that window.
      const todayMidnight = (() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })();
      const neckDays = Array.from(
        new Set(
          neckSessions.map((s) => {
            const d = new Date(s.date);
            return new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate(),
            ).getTime();
          }),
        ),
      ).sort((a, b) => b - a);
      let neckStreak = 0;
      if (neckDays[0] === todayMidnight) {
        let neckCursor = neckDays[0];
        for (const day of neckDays) {
          if (day === neckCursor) {
            neckStreak++;
            neckCursor = subDays(new Date(neckCursor), 1).getTime();
          } else break;
        }
      }
      const windowStart =
        neckDays.length > 0 ? neckDays[Math.max(0, neckDays.length - 7)] : 0;
      const noRecentNeckInjury = !neckInjuries.some(
        (i) => i.dateLogged >= windowStart,
      );
      if (neckStreak >= 7 && noRecentNeckInjury)
        gamification.unlockBadge("neck_pain_free");

      // C1-C2 Warrior: 50 total completed sets on 'Neck' category exercises
      // with no neck injury logged since tracking began.
      const totalNeckSets = neckSessions.reduce(
        (sum, s) =>
          sum +
          s.exercises
            .filter((ex) => categoryOf(ex.exerciseId) === "Neck")
            .reduce(
              (exSum, ex) =>
                exSum + ex.sets.filter((st) => st.completed).length,
              0,
            ),
        0,
      );
      if (totalNeckSets >= 50 && neckInjuries.length === 0)
        gamification.unlockBadge("c1c2_warrior");

      // Century Club: 50 total workout sessions logged
      if (newHistory.length >= 50) gamification.unlockBadge("century_club");

      // Iron Will: personal records set across 10+ distinct exercises.
      // Computed directly from newHistory (not get().getPersonalRecords()) —
      // the store's `history` state isn't updated with this session until the
      // set() call below, so reading it here would miss today's PRs.
      const prExerciseIds = new Set<string>();
      newHistory.forEach((session) => {
        session.exercises.forEach((ex) => {
          if (ex.sets.some((s) => s.completed && s.weight > 0 && s.reps > 0)) {
            prExerciseIds.add(ex.exerciseId);
          }
        });
      });
      if (prExerciseIds.size >= 10) gamification.unlockBadge("iron_will");

      // Volume Spike Warning
      let volumeSpikeWarning = false;
      if (newHistory.length >= 2) {
        const lastSession = newHistory[newHistory.length - 1];
        const prevSession = newHistory[newHistory.length - 2];
        if (lastSession.totalVolume > prevSession.totalVolume * 1.2) {
          volumeSpikeWarning = true;
        }
      }

      // Deload suggestion: same 7-day acute vs 28-day chronic ACWR used on the
      // Dashboard, but only flags a deload at a stricter threshold (>1.5) —
      // this drives an actionable banner, not just an informational number.
      let suggestDeload = false;
      const nowTs = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const chronicSessions = newHistory.filter(
        (s) => s.date >= nowTs - 28 * DAY_MS,
      );
      if (chronicSessions.length > 5) {
        const acuteSessions = newHistory.filter(
          (s) => s.date >= nowTs - 7 * DAY_MS,
        );
        const acuteVolume = acuteSessions.reduce(
          (acc, s) => acc + s.totalVolume,
          0,
        );
        const chronicWeeklyAvg =
          chronicSessions.reduce((acc, s) => acc + s.totalVolume, 0) / 4;
        const acwr =
          chronicWeeklyAvg > 0 ? acuteVolume / chronicWeeklyAvg : 1.0;
        suggestDeload = acwr > 1.5;
      }

      set({
        history: newHistory,
        activeSession: null,
        restored: false,
        scheduledSessions: state.scheduledSessions.map((s) =>
          s.id === finishedSession.scheduledId
            ? { ...s, completedSessionId: finishedSession.sessionId }
            : s,
        ),
        suggestDeload,
        volumeSpikeWarning,
      });
    } catch (error) {
      set({ saveError: String(error) });
      throw error;
    } finally {
      finishing = false;
    }
  },

  getSuggestedWeight: (exerciseId) => {
    const history = get().history;
    // Find last session that had this exercise
    for (let i = history.length - 1; i >= 0; i--) {
      const ex = history[i].exercises.find((e) => e.exerciseId === exerciseId);
      if (ex) {
        // Check if all sets were completed with RPE < 9 and high reps
        const completedSets = ex.sets.filter((s) => s.completed);
        if (completedSets.length > 0) {
          const maxWeight = Math.max(...completedSets.map((s) => s.weight));
          const allHighReps = completedSets.every((s) => s.reps >= 10);
          // Simple double progression logic
          if (allHighReps) {
            return maxWeight + 2.5;
          }
          return maxWeight; // Keep same weight
        }
      }
    }
    return 0; // Default if no history
  },

  // RPE-aware progressive-overload suggestion, with a human-readable reason
  // so the person understands *why* (surfaced as a tip in the Workout UI).
  getProgressionSuggestion: (exerciseId) => {
    const history = get().history;
    for (let i = history.length - 1; i >= 0; i--) {
      const ex = history[i].exercises.find((e) => e.exerciseId === exerciseId);
      if (!ex) continue;

      const completedSets = ex.sets.filter(
        (s) => s.completed && s.weight > 0 && s.reps > 0,
      );
      if (completedSets.length === 0) return null;

      const maxWeight = Math.max(...completedSets.map((s) => s.weight));
      const avgReps =
        completedSets.reduce((sum, s) => sum + s.reps, 0) /
        completedSets.length;
      const ratedSets = completedSets.filter((s) => s.rpe > 0);
      const avgRPE =
        ratedSets.length > 0
          ? ratedSets.reduce((sum, s) => sum + s.rpe, 0) / ratedSets.length
          : null;

      if (avgRPE !== null && avgRPE >= 9) {
        return {
          weight: maxWeight,
          reason:
            "Last session felt very hard (high RPE) — repeat this weight and focus on form.",
        };
      }
      if (avgReps >= 10 && (avgRPE === null || avgRPE <= 8)) {
        return {
          weight: maxWeight + 2.5,
          reason: `You hit ${Math.round(avgReps)}+ reps comfortably last time — try adding 2.5kg.`,
        };
      }
      if (avgReps < 6) {
        return {
          weight: maxWeight,
          reason:
            "Reps were low last session — repeat this weight before progressing.",
        };
      }
      return {
        weight: maxWeight,
        reason:
          "Close to your target reps — repeat this weight for one more session.",
      };
    }
    return null;
  },

  // All-time personal record per exercise (heaviest completed set + its
  // estimated 1-rep max via the Epley formula: 1RM = weight * (1 + reps/30)).
  getPersonalRecords: () => {
    const history = get().history;
    const records: Record<
      string,
      { bestWeight: number; bestReps: number; est1RM: number; date: number }
    > = {};

    history.forEach((session) => {
      session.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          if (!s.completed || s.weight <= 0 || s.reps <= 0) return;
          const est1RM = s.weight * (1 + s.reps / 30);
          const current = records[ex.exerciseId];
          if (!current || est1RM > current.est1RM) {
            records[ex.exerciseId] = {
              bestWeight: s.weight,
              bestReps: s.reps,
              est1RM,
              date: session.date,
            };
          }
        });
      });
    });

    return records;
  },

  updateHistoricalSession: async (sessionId, updatedSession) => {
    const state = get();
    const newHistory = state.history.map((s) => {
      if (s.sessionId !== sessionId) return s;
      const updated = { ...s, ...updatedSession, sessionId: s.sessionId };
      updated.totalVolume = updated.exercises.reduce(
        (n, e) =>
          n +
          e.sets
            .filter((s) => s.completed)
            .reduce((v, s) => v + s.weight * s.reps, 0),
        0,
      );
      return updated;
    });
    newHistory.sort((a, b) => a.date - b.date);
    set({ history: newHistory });

    const activeUserId = useUserStore.getState().activeUserId || "default_user";
    const foundSession = newHistory.find((s) => s.sessionId === sessionId);
    if (foundSession) {
      await db.workouts.put({ ...foundSession, userId: activeUserId });
    }
  },
}));

// Serialize snapshots so a slow older write can never replace a newer edit.
useWorkoutStore.subscribe((state, previous) => {
  if (hydrating) return;
  if (
    state.activeSession === previous.activeSession &&
    state.scheduledSessions === previous.scheduledSessions
  )
    return;
  const userId = useUserStore.getState().activeUserId;
  if (!userId) return;
  const active = state.activeSession
    ? structuredClone(state.activeSession)
    : null;
  const plans =
    state.scheduledSessions !== previous.scheduledSessions
      ? structuredClone(state.scheduledSessions)
      : null;
  useWorkoutStore.setState({ saving: true });
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      await db.transaction(
        "rw",
        [db.active_workouts, db.schedules],
        async () => {
          if (active) await db.active_workouts.put({ userId, session: active });
          else await db.active_workouts.delete(userId);
          if (plans) {
            await db.schedules.where("userId").equals(userId).delete();
            await db.schedules.bulkPut(plans.map((s) => ({ ...s, userId })));
          }
        },
      );
      useWorkoutStore.setState({ saving: false, saveError: null });
    });
  void writes.catch((error) =>
    useWorkoutStore.setState({ saving: false, saveError: String(error) }),
  );
});
