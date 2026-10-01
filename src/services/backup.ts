import db, {
  type UserEntity,
  type DailyLogEntity,
  type DBWorkoutSession,
  type DBCustomExercise,
  type InjuryEntry,
  type CustomFood,
  type MeasurementEntry,
  type ProgressPhoto,
  type Recipe,
} from "../db/db";
import type {
  WorkoutSession,
  ScheduledSession,
} from "../store/useWorkoutStore";
import { flushWorkoutWrites } from "../store/useWorkoutStore";
import { type Food, validateFood } from "../food/model";
import { validateMeasurement } from "./measurements";
export const EXPORT_FORMAT_VERSION = 2;
export interface UserDataExport {
  formatVersion: number;
  exportedAt: string;
  userId: string;
  users: UserEntity[];
  daily_logs: DailyLogEntity[];
  workouts: DBWorkoutSession[];
  custom_exercises: DBCustomExercise[];
  injuries: InjuryEntry[];
  custom_foods: CustomFood[];
  measurements: MeasurementEntry[];
  progress_photos: ProgressPhoto[];
  recipes: Recipe[];
  active_workouts: { userId: string; session: WorkoutSession }[];
  schedules: (ScheduledSession & { userId: string })[];
  foods: Food[];
  preferences: { id: string; value: string }[];
}
const owned = [
  "daily_logs",
  "workouts",
  "custom_exercises",
  "injuries",
  "custom_foods",
  "measurements",
  "progress_photos",
  "recipes",
  "active_workouts",
  "schedules",
] as const;
const portablePreferences = new Set([
  "omnibody-lang",
  "omnibody-onboarding",
  "omnibody-health-storage",
  "omnibody-device-storage",
]);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid backup: ${message}`);
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const id = (x: unknown): x is string =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 2000 &&
  !["__proto__", "constructor", "prototype"].includes(x);
const num = (x: unknown, max = 1e8) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max;
const date = (x: unknown) => num(x, Date.now() + 366 * 86400000);
function safeTree(x: unknown, depth = 0) {
  assert(depth < 30, "nesting");
  if (typeof x === "number") assert(Number.isFinite(x), "number");
  if (object(x))
    for (const [k, v] of Object.entries(x)) {
      assert(
        !["__proto__", "constructor", "prototype"].includes(k),
        "unsafe key",
      );
      safeTree(v, depth + 1);
    }
  if (Array.isArray(x)) {
    assert(x.length <= 100000, "record limit");
    x.forEach((v) => safeTree(v, depth + 1));
  }
}
function session(w: WorkoutSession) {
  assert(
    id(w.sessionId) &&
      date(w.date) &&
      typeof w.type === "string" &&
      Array.isArray(w.exercises) &&
      typeof w.isFinished === "boolean" &&
      ["warmup", "main", "cooldown"].includes(w.phase),
    "workout",
  );
  assert(num(w.totalVolume), "volume");
  for (const ex of w.exercises) {
    assert(
      id(ex.exerciseId) &&
        Array.isArray(ex.sets) &&
        typeof ex.notes === "string" &&
        Array.isArray(ex.voiceNotes),
      "exercise",
    );
    for (const s of ex.sets)
      assert(
        num(s.weight, 2000) &&
          num(s.reps, 10000) &&
          num(s.rpe, 10) &&
          num(s.setNumber, 1000) &&
          typeof s.completed === "boolean",
        "set",
      );
  }
  if (w.finishedAt !== undefined)
    assert(date(w.finishedAt) && w.finishedAt >= w.date, "finish date");
  if (w.restEndsAt != null) assert(date(w.restEndsAt), "timer");
}
export function validateBackup(value: unknown): UserDataExport {
  assert(object(value), "object");
  safeTree(value);
  const d = structuredClone(value) as unknown as UserDataExport;
  assert(
    [1, 2].includes(d.formatVersion) &&
      id(d.userId) &&
      typeof d.exportedAt === "string" &&
      Number.isFinite(Date.parse(d.exportedAt)),
    "version or header",
  );
  if (d.formatVersion === 1) {
    d.active_workouts = [];
    d.schedules = [];
    d.foods = [];
    d.preferences = [];
    for (const table of owned) if (!d[table]) Object.assign(d, { [table]: [] });
  }
  for (const table of ["users", ...owned, "foods", "preferences"] as const)
    assert(Array.isArray(d[table]), table);
  assert(
    d.users.length === 1 && d.users[0].id === d.userId,
    "one owner required",
  );
  const u = d.users[0];
  assert(
    object(u.profile) &&
      typeof u.profile.name === "string" &&
      num(u.profile.age, 130) &&
      num(u.profile.weight, 1000) &&
      num(u.profile.height, 300) &&
      Array.isArray(u.profile.goals) &&
      typeof u.profile.level === "string",
    "profile",
  );
  assert(
    Array.isArray(u.supplements) && Array.isArray(u.weightHistory),
    "user domains",
  );
  for (const s of u.supplements)
    assert(
      id(s.id) &&
        typeof s.name === "string" &&
        typeof s.dose === "string" &&
        typeof s.timing === "string" &&
        Array.isArray(s.taken) &&
        s.taken.every((t) => typeof t === "boolean"),
      "supplement",
    );
  for (const w of u.weightHistory)
    assert(date(w.date) && num(w.weight, 1000), "weight");
  if (u.exercisePrefs) {
    assert(
      Array.isArray(u.exercisePrefs.favorites) &&
        u.exercisePrefs.favorites.every(id) &&
        Array.isArray(u.exercisePrefs.templates),
      "exercise preferences",
    );
    for (const t of u.exercisePrefs.templates)
      assert(
        id(t.id) &&
          typeof t.name === "string" &&
          Array.isArray(t.exerciseIds) &&
          t.exerciseIds.every(id),
        "template",
      );
  }
  if (u.gamification)
    assert(
      num(u.gamification.xp) &&
        num(u.gamification.level, 100000) &&
        Array.isArray(u.gamification.badges),
      "gamification",
    );
  for (const table of owned) {
    const seen = new Set<string>();
    for (const raw of d[table]) {
      assert(object(raw) && raw.userId === d.userId, `${table} owner`);
      const key =
        table === "workouts"
          ? (raw as unknown as Record<string, unknown>).sessionId
          : table === "active_workouts"
            ? raw.userId
            : (raw as unknown as Record<string, unknown>).id;
      assert(id(key) && !seen.has(key), `${table} duplicate ID`);
      seen.add(key);
    }
  }
  for (const w of d.workouts) session(w);
  assert(d.active_workouts.length <= 1, "one active session");
  for (const w of d.active_workouts) {
    session(w.session);
    assert(!w.session.isFinished, "active is finished");
  }
  for (const s of d.schedules)
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
        new Date(`${s.date}T12:00:00Z`).toISOString().slice(0, 10) === s.date &&
        typeof s.type === "string" &&
        Array.isArray(s.exerciseIds) &&
        s.exerciseIds.every(id),
      "schedule",
    );
  for (const m of d.measurements) validateMeasurement(m);
  for (const log of d.daily_logs) {
    assert(
      date(log.date) &&
        num(log.waterMl, 100000) &&
        Array.isArray(log.meals) &&
        object(log.supplementsTaken),
      "daily log",
    );
    for (const doses of Object.values(log.supplementsTaken))
      assert(
        Array.isArray(doses) && doses.every((v) => typeof v === "boolean"),
        "doses",
      );
    for (const meal of log.meals) {
      assert(
        id(meal.id) &&
          [
            "Breakfast",
            "Lunch",
            "Dinner",
            "Snacks",
            "Pre-workout",
            "Post-workout",
            "Supplements",
          ].includes(meal.type) &&
          Array.isArray(meal.foods),
        "meal",
      );
      const seen = new Set<string>();
      for (const f of meal.foods) {
        if (!f.id && d.formatVersion === 1) f.id = crypto.randomUUID();
        assert(
          id(f.id) &&
            !seen.has(f.id) &&
            id(f.foodId) &&
            typeof f.name === "string" &&
            typeof f.unit === "string" &&
            num(f.amount, 1e7),
          "food occurrence",
        );
        seen.add(f.id);
        for (const k of ["calories", "protein", "carbs", "fats"] as const)
          assert(num(f[k]), "macros");
        if (f.nutrients)
          for (const n of Object.values(f.nutrients))
            assert(num(n), "nutrients");
      }
    }
  }
  for (const f of d.foods) {
    validateFood(f);
    assert(
      f.source === "custom" ? f.userId === d.userId : !f.userId,
      "food owner",
    );
  }
  for (const f of d.custom_foods)
    assert(
      typeof f.name === "string" &&
        num(f.calories) &&
        num(f.protein) &&
        num(f.carbs) &&
        num(f.fats),
      "legacy food",
    );
  for (const e of d.custom_exercises)
    assert(
      typeof e.name === "string" &&
        typeof e.muscleGroup === "string" &&
        typeof e.category === "string" &&
        Array.isArray(e.equipment),
      "custom exercise",
    );
  for (const i of d.injuries)
    assert(
      date(i.dateLogged) &&
        typeof i.bodyPart === "string" &&
        num(i.severity, 10) &&
        ["Active", "Recovering", "Healed"].includes(i.status),
      "injury",
    );
  for (const p of d.progress_photos)
    assert(
      date(p.date) &&
        typeof p.photo === "string" &&
        /^data:image\/(jpeg|png|webp);base64,/.test(p.photo),
      "photo",
    );
  for (const r of d.recipes) {
    assert(
      date(r.createdAt) && typeof r.name === "string" && Array.isArray(r.items),
      "recipe",
    );
    for (const item of r.items)
      assert(id(item.foodId) && num(item.amount, 1e7), "recipe item");
  }
  for (const p of d.preferences)
    assert(
      portablePreferences.has(p.id) &&
        typeof p.value === "string" &&
        object(JSON.parse(p.value)),
      "preference",
    );
  return d;
}
export function isValidUserDataExport(d: unknown): d is UserDataExport {
  try {
    validateBackup(d);
    return true;
  } catch {
    return false;
  }
}
export async function buildUserDataExport(
  userId: string,
): Promise<UserDataExport> {
  await flushWorkoutWrites();
  return db.transaction("r", db.tables, async () => {
    const result: Record<string, unknown> = {
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      userId,
      users: await db.users.where("id").equals(userId).toArray(),
    };
    for (const table of owned)
      result[table] = await db
        .table(table)
        .where("userId")
        .equals(userId)
        .toArray();
    result.foods = await db.foods
      .filter((f) => !f.userId || f.userId === userId)
      .toArray();
    result.preferences = await db.preferences
      .filter((p) => portablePreferences.has(p.id))
      .toArray();
    return result as unknown as UserDataExport;
  });
}
/** Merge retains target profile and existing day logs/active session, adds imported records.
 * Replace clears ONLY target-owned data. Device secrets, permissions and other users survive.
 * Cross-user IDs and references are deterministically namespaced; repeat imports are idempotent. */
export async function importUserDataJSON(
  value: unknown,
  targetUserId: string,
  mode: "merge" | "replace" = "merge",
) {
  const d = validateBackup(value);
  assert(id(targetUserId), "target");
  await flushWorkoutWrites();
  const map = (key: string) =>
    d.userId === targetUserId
      ? key
      : `import:${encodeURIComponent(targetUserId)}:${encodeURIComponent(d.userId)}:${key}`;
  const exIds = new Set(d.custom_exercises.map((e) => e.id)),
    foodIds = new Set(
      d.foods.filter((f) => f.source === "custom").map((f) => f.id),
    );
  const ex = (key: string) => (exIds.has(key) ? map(key) : key),
    food = (key: string) => {
      if (foodIds.has(key)) return map(key);
      const supplement = d.users[0].supplements.find((s) =>
        key.startsWith(`supplement_${s.id}_`),
      );
      return supplement
        ? key.replace(
            `supplement_${supplement.id}_`,
            `supplement_${map(supplement.id)}_`,
          )
        : key;
    };
  const workout = (s: WorkoutSession) => ({
    ...s,
    sessionId: map(s.sessionId),
    scheduledId: s.scheduledId ? map(s.scheduledId) : undefined,
    exercises: s.exercises.map((e) => ({ ...e, exerciseId: ex(e.exerciseId) })),
  });
  await db.transaction("rw", db.tables, async () => {
    const existing = await db.users.get(targetUserId);
    assert(existing, "target user does not exist");
    if (mode === "replace") {
      for (const table of owned)
        await db.table(table).where("userId").equals(targetUserId).delete();
      await db.foods.where("userId").equals(targetUserId).delete();
    }
    const user = d.users[0];
    if (mode === "replace")
      await db.users.put({
        ...user,
        id: targetUserId,
        supplements: user.supplements.map((s) => ({ ...s, id: map(s.id) })),
        exercisePrefs: user.exercisePrefs
          ? {
              favorites: user.exercisePrefs.favorites.map(ex),
              templates: user.exercisePrefs.templates.map((t) => ({
                ...t,
                id: map(t.id),
                exerciseIds: t.exerciseIds.map(ex),
              })),
            }
          : undefined,
      });
    else if (user.exercisePrefs) {
      const old = existing.exercisePrefs || { favorites: [], templates: [] };
      await db.users.update(targetUserId, {
        exercisePrefs: {
          favorites: [
            ...new Set([
              ...old.favorites,
              ...user.exercisePrefs.favorites.map(ex),
            ]),
          ],
          templates: [
            ...new Map(
              [
                ...old.templates,
                ...user.exercisePrefs.templates.map((t) => ({
                  ...t,
                  id: map(t.id),
                  exerciseIds: t.exerciseIds.map(ex),
                })),
              ].map((t) => [t.id, t]),
            ).values(),
          ],
        },
      });
    }
    if (mode === "merge") {
      const weightHistory = [
        ...new Map(
          [...user.weightHistory, ...existing.weightHistory].map((w) => [
            `${w.date}:${w.weight}`,
            w,
          ]),
        ).values(),
      ].sort((a, b) => a.date - b.date);
      const supplements = [
        ...new Map(
          [
            ...user.supplements.map((s) => ({ ...s, id: map(s.id) })),
            ...existing.supplements,
          ].map((s) => [s.id, s]),
        ).values(),
      ];
      await db.users.update(targetUserId, { weightHistory, supplements });
      if (user.gamification) {
        const previous = existing.gamification;
        const xp = Math.max(previous?.xp || 0, user.gamification.xp);
        const badges = [
          ...new Map(
            [...user.gamification.badges, ...(previous?.badges || [])].map(
              (b) => {
                const imported = user.gamification?.badges.find(
                  (i) => i.id === b.id,
                );
                return [
                  b.id,
                  { ...b, unlocked: b.unlocked || !!imported?.unlocked },
                ];
              },
            ),
          ).values(),
        ];
        await db.users.update(targetUserId, {
          gamification: {
            xp,
            level: Math.floor(Math.sqrt(xp / 100)) + 1,
            badges,
          },
        });
      }
    }
    for (const table of owned)
      for (const original of d[table]) {
        let row: Record<string, unknown> = {
          ...original,
          userId: targetUserId,
        };
        if (table === "workouts")
          row = {
            ...workout(original as DBWorkoutSession),
            userId: targetUserId,
          };
        else if (table === "active_workouts") {
          if (mode === "merge" && (await db.active_workouts.get(targetUserId)))
            continue;
          row = {
            userId: targetUserId,
            session: workout((original as { session: WorkoutSession }).session),
          };
        } else row.id = map((original as { id: string }).id);
        if (table === "daily_logs") {
          const log = original as DailyLogEntity;
          row.id = `${targetUserId}_${log.date}`;
          row.meals = log.meals.map((m) => ({
            ...m,
            id: map(m.id),
            foods: m.foods.map((f) => ({
              ...f,
              id: map(f.id!),
              foodId: food(f.foodId),
            })),
          }));
          row.supplementsTaken = Object.fromEntries(
            Object.entries(log.supplementsTaken).map(([id, doses]) => [
              map(id),
              doses,
            ]),
          );
          row.supplementPlan = log.supplementPlan
            ? Object.fromEntries(
                Object.entries(log.supplementPlan).map(([id, plan]) => [
                  map(id),
                  plan,
                ]),
              )
            : undefined;
          if (mode === "merge" && (await db.daily_logs.get(row.id as string)))
            continue;
        }
        if (table === "schedules") {
          const s = original as ScheduledSession;
          row.exerciseIds = s.exerciseIds.map(ex);
          row.completedSessionId = s.completedSessionId
            ? map(s.completedSessionId)
            : undefined;
        }
        if (table === "recipes")
          row.items = (original as Recipe).items.map((i) => ({
            ...i,
            foodId: food(i.foodId),
            snapshot: i.snapshot
              ? { ...i.snapshot, foodId: food(i.snapshot.foodId) }
              : undefined,
          }));
        const key =
          table === "workouts"
            ? row.sessionId
            : table === "active_workouts"
              ? row.userId
              : row.id;
        const prior = await db.table(table).get(key as string);
        assert(
          !prior || prior.userId === targetUserId,
          "ID belongs to another user",
        );
        if (mode === "merge" && prior) continue;
        await db.table(table).put(row);
      }
    for (const f of d.foods) {
      if (f.source !== "custom") {
        if (!(await db.foods.get(f.id))) await db.foods.put(f);
        continue;
      }
      const next = { ...f, id: map(f.id), userId: targetUserId };
      const old = await db.foods.get(next.id);
      assert(
        !old || old.userId === targetUserId,
        "food ID belongs to another user",
      );
      if (mode === "replace" || !old) await db.foods.put(next);
    }
    for (const p of d.preferences)
      if (mode === "replace" || !(await db.preferences.get(p.id)))
        await db.preferences.put(p);
  });
}
