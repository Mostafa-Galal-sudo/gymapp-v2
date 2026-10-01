import { useEffect, useState, useRef } from "react";
import { format, startOfDay } from "date-fns";
import { useNutritionStore, type Meal } from "../store/useNutritionStore";
import { useUserStore } from "../store/useUserStore";
import { useLanguageStore } from "../store/useLanguageStore";
import { useFoodSearch } from "../hooks/useFoodSearch";
import { foodRepository } from "../food/repository";
import { type Food, type Nutrient, nutrientUnits } from "../food/model";
import { foodSnapshot, storedNutrients } from "../food/snapshot";
import { Sheet } from "../components/Sheet";
import db from "../db/db";

const meals: Meal["type"][] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
  "Pre-workout",
  "Post-workout",
];
const mealArabic = [
  "الفطار",
  "الغداء",
  "العشاء",
  "وجبة خفيفة",
  "قبل التمرين",
  "بعد التمرين",
];
const nutrientArabic: Partial<Record<Nutrient, string>> = {
  calories: "السعرات",
  protein: "البروتين",
  carbs: "الكربوهيدرات",
  fats: "الدهون",
  fiber: "الألياف",
  sugar: "السكر",
  sodium: "الصوديوم",
  calcium: "الكالسيوم",
  iron: "الحديد",
  potassium: "البوتاسيوم",
};
function FoodEditor({
  food,
  userId,
  onClose,
}: {
  food?: Food;
  userId: string;
  onClose: () => void;
}) {
  const ar = useLanguageStore((s) => s.lang === "ar");
  const [draft, setDraft] = useState<Food>(
    () =>
      food || {
        id: crypto.randomUUID(),
        name: "",
        source: "custom",
        sourceId: "",
        servingSize: 100,
        servingUnit: "g",
        nutrients: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fetchedAt: Date.now(),
      },
  );
  const [error, setError] = useState("");
  return (
    <Sheet title={ar ? "طعام مخصص" : "Custom food"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await foodRepository.saveCustom(
              { ...draft, sourceId: draft.id },
              userId,
            );
            onClose();
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <label>
          {ar ? "الاسم" : "Name"}
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          {ar ? "الاسم بالعربي" : "Arabic name"}
          <input
            value={draft.nameAr || ""}
            onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
          />
        </label>
        <div className="input-pair">
          <label>
            {ar ? "حجم الحصة" : "Serving size"}
            <input
              type="number"
              inputMode="decimal"
              min="0.1"
              step="any"
              required
              value={draft.servingSize}
              onChange={(e) =>
                setDraft({ ...draft, servingSize: Number(e.target.value) })
              }
            />
          </label>
          <label>
            {ar ? "الوحدة" : "Unit"}
            <select
              value={draft.servingUnit}
              onChange={(e) =>
                setDraft({ ...draft, servingUnit: e.target.value })
              }
            >
              <option>g</option>
              <option>ml</option>
              <option>piece</option>
            </select>
          </label>
        </div>
        <p className="muted">
          {ar
            ? "القيم للحصة المحددة. اترك القيم غير المعروفة فارغة."
            : "Values per serving. Leave unknown nutrients blank."}
        </p>
        <div className="input-pair">
          {(Object.keys(nutrientUnits) as Nutrient[]).map((key) => (
            <label key={key}>
              {ar ? nutrientArabic[key] || key : key} ({nutrientUnits[key]})
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="10000000"
                step="any"
                value={draft.nutrients[key] ?? ""}
                onChange={(e) => {
                  const nutrients = { ...draft.nutrients };
                  if (e.target.value === "") delete nutrients[key];
                  else nutrients[key] = Number(e.target.value);
                  setDraft({ ...draft, nutrients });
                }}
              />
            </label>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="btn-primary sticky-action" type="submit">
          {ar ? "حفظ الطعام" : "Save food"}
        </button>
      </form>
    </Sheet>
  );
}
function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (code: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const resultRef = useRef(onResult);
  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    let stopped = false;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    void import("html5-qrcode")
      .then(async ({ Html5Qrcode }) => {
        if (stopped) return;
        scanner = new Html5Qrcode("barcode-camera");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 130 } },
          (code) => {
            if (!stopped) {
              stopped = true;
              void scanner?.stop();
              resultRef.current(code);
            }
          },
          () => undefined,
        );
        if (stopped && scanner.isScanning) await scanner.stop();
      })
      .catch((e) => setError(String(e)));
    return () => {
      stopped = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => undefined);
    };
  }, []);
  return (
    <Sheet title="Barcode" onClose={onClose}>
      <div id="barcode-camera" />
      {error && <p role="alert">{error}</p>}
    </Sheet>
  );
}
export default function Nutrition() {
  const ar = useLanguageStore((s) => s.lang === "ar");
  const userId = useUserStore((s) => s.activeUserId) || "default_user";
  const supplements = useUserStore((s) => s.supplements);
  const history = useNutritionStore((s) => s.history),
    recipes = useNutritionStore((s) => s.recipes);
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const day = startOfDay(new Date(`${date}T12:00:00`)).getTime();
  const log = history[day] || useNutritionStore.getState().getLogForDate(day);
  const [query, setQuery] = useState(""),
    [revision, setRevision] = useState(0);
  const [meal, setMeal] = useState<Meal["type"]>("Breakfast");
  const [chosen, setChosen] = useState<Food | null>(null),
    [amount, setAmount] = useState(100);
  const [editing, setEditing] = useState<Food | "new" | null>(null),
    [scanner, setScanner] = useState(false);
  const [barcode, setBarcode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false),
    [key, setKey] = useState("");
  const {
    foods,
    loading,
    error: searchError,
  } = useFoodSearch(query, userId, revision);
  const targets = log.targets || useNutritionStore.getState().getTargets();
  const all = log.meals.flatMap((m) => m.foods);
  const total = (key: Nutrient) =>
    all.reduce((n, f) => n + (storedNutrients(f)[key] ?? 0), 0);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const lookup = async (code: string) => {
    setScanner(false);
    await act(async () => {
      const food = await foodRepository.barcode(code);
      setChosen(food);
      setAmount(food.servingSize);
    });
  };
  return (
    <div className="page nutrition-page">
      <header className="page-head">
        <div>
          <h1>{ar ? "التغذية" : "Nutrition"}</h1>
          <p>{ar ? "سجل بسيط لكل وجبة" : "A clear record of every meal"}</p>
        </div>
        <button
          onClick={() => setSettings(true)}
          aria-label={ar ? "إعدادات البحث" : "Search settings"}
        >
          ⚙
        </button>
      </header>
      <input
        aria-label={ar ? "التاريخ" : "Date"}
        type="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
      />
      <section className="panel">
        <div className="metric-grid">
          {(["calories", "protein", "carbs", "fats"] as const).map((n) => (
            <div key={n}>
              <small>{ar ? nutrientArabic[n] : n}</small>
              <strong>
                {Math.round(total(n))}
                <span> {nutrientUnits[n]}</span>
              </strong>
              <progress value={total(n)} max={targets[n]} />
              <small>
                {ar ? "هدف" : "Target"} {targets[n]}
              </small>
            </div>
          ))}
        </div>
        <details>
          <summary>
            {ar ? "كل العناصر المسجلة" : "All recorded nutrients"}
          </summary>
          <p className="muted">
            {ar
              ? "الناقص غير معروف. البيانات القديمة قد تحتوي على تقديرات."
              : "Missing values are unknown. Older entries may contain estimates."}
          </p>
          <div className="nutrient-list">
            {(Object.keys(nutrientUnits) as Nutrient[])
              .filter((n) =>
                all.some((f) => storedNutrients(f)[n] !== undefined),
              )
              .map((n) => (
                <div key={n}>
                  <span>{ar ? nutrientArabic[n] || n : n}</span>
                  <strong>
                    {total(n).toFixed(1)} {nutrientUnits[n]}
                  </strong>
                </div>
              ))}
          </div>
        </details>
      </section>
      <section className="panel" data-walkthrough="nutrition-search">
        <h2>{ar ? "إضافة طعام" : "Add food"}</h2>
        <label>
          {ar ? "الوجبة" : "Meal"}
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as Meal["type"])}
          >
            {meals.map((m, i) => (
              <option key={m} value={m}>
                {ar ? mealArabic[i] : m}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          aria-label={ar ? "بحث طعام" : "Search food"}
          placeholder={ar ? "ابحث باسم الطعام في USDA" : "Search USDA foods"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="action-row">
          <button onClick={() => setEditing("new")}>
            {ar ? "طعام مخصص" : "Custom food"}
          </button>
          <button
            data-walkthrough="scan-button"
            onClick={() => setScanner(true)}
          >
            {ar ? "مسح الباركود" : "Scan barcode"}
          </button>
        </div>
        <details>
          <summary>
            {ar ? "إدخال الباركود يدوياً" : "Enter barcode manually"}
          </summary>
          <div className="action-row">
            <input
              inputMode="numeric"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              aria-label="Barcode"
            />
            <button onClick={() => void lookup(barcode)} disabled={busy}>
              {ar ? "بحث" : "Find"}
            </button>
          </div>
        </details>
        {loading && (
          <p role="status">
            {ar ? "جاري تحديث النتائج…" : "Refreshing results…"}
          </p>
        )}
        {searchError && (
          <p role="status">
            {ar ? "البحث غير متاح. استخدم الأطعمة المحفوظة." : searchError}
          </p>
        )}
        {!loading && !foods.length && (
          <p className="empty-state">
            {ar
              ? "ابحث عن طعام أو أضف وجبتك المحلية."
              : "Search for a food or add your own local dish."}
          </p>
        )}
        {foods.map((food) => (
          <div className="list-row" key={food.id}>
            <button
              className="row-main"
              onClick={() => {
                setChosen(food);
                setAmount(food.servingSize);
              }}
            >
              <strong>{ar && food.nameAr ? food.nameAr : food.name}</strong>
              <small>
                {food.source.toUpperCase()} · {food.nutrients.calories ?? "—"}{" "}
                kcal / {food.servingSize} {food.servingUnit}
              </small>
            </button>
            {food.source === "custom" && (
              <>
                <button
                  aria-label={ar ? "تعديل" : "Edit"}
                  onClick={() => setEditing(food)}
                >
                  ✎
                </button>
                <button
                  aria-label={ar ? "حذف" : "Delete"}
                  onClick={() => {
                    if (
                      confirm(
                        ar
                          ? "حذف الطعام؟ السجل السابق لن يتغير."
                          : "Delete food? Existing logs will stay unchanged.",
                      )
                    )
                      void act(async () => {
                        await foodRepository.deleteCustom(food.id, userId);
                        setRevision((r) => r + 1);
                      });
                  }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
        <small className="muted">
          U.S. Department of Agriculture, FoodData Central · Open Food Facts
        </small>
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>{ar ? "الماء" : "Water"}</h2>
          <strong>
            {log.waterMl} / {targets.water} ml
          </strong>
        </div>
        <progress max={targets.water} value={log.waterMl} />
        <div className="action-row">
          {[150, 250, 500].map((ml) => (
            <button
              key={ml}
              onClick={() =>
                void act(() => useNutritionStore.getState().addWater(day, ml))
              }
            >
              +{ml} ml
            </button>
          ))}
          <button
            onClick={() => {
              if (confirm(ar ? "تصفير الماء؟" : "Reset water?"))
                void act(() => useNutritionStore.getState().resetWater(day));
            }}
          >
            ↺
          </button>
        </div>
      </section>
      <section className="panel" data-walkthrough="recipes-section">
        <h2>{ar ? "وصفات محفوظة" : "Saved recipes"}</h2>
        {recipes.map((r) => (
          <div className="list-row" key={r.id}>
            <button
              className="row-main"
              onClick={() =>
                void act(() =>
                  useNutritionStore.getState().logRecipe(day, meal, r.id),
                )
              }
            >
              {r.name} +
            </button>
            <button
              aria-label="Delete recipe"
              onClick={() => {
                if (confirm(ar ? "حذف الوصفة؟" : "Delete recipe?"))
                  void act(() =>
                    useNutritionStore.getState().deleteRecipe(r.id),
                  );
              }}
            >
              ×
            </button>
          </div>
        ))}
        <p className="muted">
          {ar
            ? "احفظ أي وجبة مسجلة كوصفة لإضافتها مرة أخرى."
            : "Save any logged meal as a recipe to log it again."}
        </p>
      </section>
      {log.meals
        .filter((m) => m.type !== "Supplements")
        .map((m) => (
          <section className="panel" key={m.id}>
            <div className="section-head">
              <h2>
                {ar ? mealArabic[meals.indexOf(m.type)] || m.type : m.type}
              </h2>
              <button
                onClick={() => {
                  setMeal(m.type);
                  document
                    .querySelector<HTMLInputElement>("input[type=search]")
                    ?.focus();
                }}
              >
                +
              </button>
            </div>
            {!m.foods.length && (
              <p className="muted">
                {ar ? "لا يوجد طعام مسجل" : "No food logged yet"}
              </p>
            )}
            {m.foods.map((f) => (
              <div className="list-row" key={f.id}>
                <div className="row-main">
                  <strong>{ar && f.nameAr ? f.nameAr : f.name}</strong>
                  <small>
                    {f.amount} {f.unit} · {f.calories} kcal
                  </small>
                </div>
                <button
                  aria-label={ar ? "حذف العنصر" : "Remove entry"}
                  onClick={() =>
                    void act(() =>
                      useNutritionStore.getState().removeFood(day, m.id, f.id!),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
            {!!m.foods.length && (
              <div className="action-row">
                <button
                  onClick={() => {
                    const name = prompt(ar ? "اسم الوصفة" : "Recipe name");
                    if (name?.trim())
                      void act(() =>
                        useNutritionStore.getState().saveRecipe(
                          name.trim(),
                          m.foods.map((f) => ({
                            foodId: f.foodId,
                            amount: f.amount,
                            snapshot: structuredClone(f),
                          })),
                        ),
                      );
                  }}
                >
                  {ar ? "حفظ كوصفة" : "Save as recipe"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(ar ? "مسح الوجبة؟" : "Clear meal?"))
                      void act(() =>
                        useNutritionStore.getState().resetMeal(day, m.type),
                      );
                  }}
                >
                  {ar ? "مسح" : "Clear"}
                </button>
              </div>
            )}
          </section>
        ))}
      <section className="panel">
        <h2>{ar ? "المكملات" : "Supplements"}</h2>
        {supplements.map((s) => (
          <div className="list-row" key={s.id}>
            <div className="row-main">
              <strong>{s.name}</strong>
              <small>{s.dose}</small>
            </div>
            {s.taken.map((_, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  aria-label={`${s.name} ${i + 1}`}
                  checked={!!log.supplementsTaken?.[s.id]?.[i]}
                  onChange={() =>
                    void act(() =>
                      useNutritionStore
                        .getState()
                        .toggleSupplement(day, s.id, i),
                    )
                  }
                />
                {i + 1}
              </label>
            ))}
          </div>
        ))}
      </section>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {chosen && (
        <Sheet
          title={ar && chosen.nameAr ? chosen.nameAr : chosen.name}
          onClose={() => setChosen(null)}
        >
          <p>{chosen.servingLabel}</p>
          <label>
            {ar ? "الكمية" : "Amount"} ({chosen.servingUnit})
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0.1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <button
            className="btn-primary"
            disabled={busy || !(amount > 0)}
            onClick={() =>
              void act(async () => {
                await useNutritionStore
                  .getState()
                  .addFood(day, meal, foodSnapshot(chosen, amount));
                setChosen(null);
              })
            }
          >
            {ar ? "إضافة للوجبة" : "Add to meal"}
          </button>
        </Sheet>
      )}
      {editing && (
        <FoodEditor
          food={editing === "new" ? undefined : editing}
          userId={userId}
          onClose={() => {
            setEditing(null);
            setRevision((r) => r + 1);
          }}
        />
      )}{" "}
      {scanner && (
        <BarcodeScanner onResult={lookup} onClose={() => setScanner(false)} />
      )}
      {settings && (
        <Sheet
          title={ar ? "إعدادات USDA" : "USDA settings"}
          onClose={() => setSettings(false)}
        >
          <p>
            {ar
              ? "أدخل مفتاحك الشخصي. محفوظ على هذا الجهاز فقط ولا يدخل في النسخة الاحتياطية. المفتاح التجريبي محدود."
              : "Enter your personal key. Stored on this device only and excluded from backups. The demo key has limited requests."}
          </p>
          <input
            type="password"
            autoComplete="off"
            aria-label="USDA API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={() =>
              void act(async () => {
                if (key.trim())
                  await db.preferences.put({
                    id: "usda-api-key",
                    value: key.trim(),
                  });
                else await db.preferences.delete("usda-api-key");
                setKey("");
                setSettings(false);
                setRevision((r) => r + 1);
              })
            }
          >
            {ar ? "حفظ" : "Save"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
