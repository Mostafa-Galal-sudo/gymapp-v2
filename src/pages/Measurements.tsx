import { useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { useLanguageStore } from "../store/useLanguageStore";
import { useMeasurementsStore } from "../store/useMeasurementsStore";
import {
  measurementFields,
  measurementValues,
  difference,
  compareMeasurements,
  symmetry,
} from "../services/measurements";
import type { MeasurementEntry } from "../db/db";
import { Sheet } from "../components/Sheet";
import { setWeeklyCheckInReminder } from "../services/notificationService";
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
export default function Measurements() {
  const ar = useLanguageStore((s) => s.lang) === "ar";
  const { measurements, addMeasurement, updateMeasurement, deleteMeasurement } =
    useMeasurementsStore();
  const [editing, setEditing] = useState<MeasurementEntry | null | undefined>();
  const [values, setValues] = useState<Record<string, number>>({});
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<MeasurementEntry>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const previous = measurements
    .filter(
      (m) =>
        m.id !== editing?.id && m.date < new Date(`${date}T23:59:59`).getTime(),
    )
    .at(-1);
  const prev = previous ? measurementValues(previous) : {};
  const open = (entry: MeasurementEntry | null) => {
    setEditing(entry);
    setValues(entry ? measurementValues(entry) : {});
    setNotes(entry?.notes || "");
    setDate(format(entry?.date || Date.now(), "yyyy-MM-dd"));
    setError("");
  };
  async function save() {
    setSaving(true);
    try {
      const entry = {
        date: new Date(`${date}T12:00:00`).getTime(),
        values,
        notes,
      };
      if (editing) await updateMeasurement(editing.id, entry);
      else await addMeasurement(entry);
      setEditing(undefined);
      setSelected(
        useMeasurementsStore
          .getState()
          .measurements.find((m) =>
            editing ? m.id === editing.id : m.date === entry.date,
          ),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }
  const comparisons = selected
    ? compareMeasurements(selected, measurements)
    : null;
  return (
    <div className="journal-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            {ar ? "تقدمك بمرور الوقت" : "YOUR PROGRESS, OVER TIME"}
          </span>
          <h1>{ar ? "قياسات الجسم" : "Body measurements"}</h1>
          <p>
            {ar
              ? "متابعة أسبوعية سريعة. سجّل ما يهمك."
              : "A quick weekly check-in. Record what matters to you."}
          </p>
        </div>
        <Link to="/insights">{ar ? "التحليلات" : "Insights"} →</Link>
      </header>
      <button className="btn btn-primary full-width" onClick={() => open(null)}>
        {ar ? "＋ متابعة أسبوعية" : "＋ Weekly check-in"}
      </button>
      <div className="panel row">
        <span>
          {ar
            ? "تذكير الجمعة ٩ صباحاً (أندرويد)"
            : "Friday, 9am local reminder (Android)"}
        </span>
        <button
          className="btn"
          onClick={() =>
            void setWeeklyCheckInReminder(true, ar).then((ok) =>
              setError(
                ok
                  ? ar
                    ? "تم ضبط التذكير"
                    : "Reminder enabled"
                  : ar
                    ? "يلزم أندرويد وإذن الإشعارات"
                    : "Android notification permission is required",
              ),
            )
          }
        >
          {ar ? "تفعيل" : "Enable"}
        </button>
        <button
          className="btn"
          onClick={() =>
            void setWeeklyCheckInReminder(false, ar).then(() =>
              setError(ar ? "تم الإلغاء" : "Reminder disabled"),
            )
          }
        >
          {ar ? "إلغاء" : "Disable"}
        </button>
      </div>
      {error && (
        <p role="status" className="status-banner">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>{ar ? "سجل القياسات" : "Check-in history"}</h2>
        {!measurements.length && (
          <p className="empty-state">
            {ar
              ? "ابدأ بأول قياس. المقارنات ستظهر بعد تسجيل قياس آخر."
              : "Start with your first check-in. Comparisons appear when you have a baseline."}
          </p>
        )}
        {[...measurements].reverse().map((m) => (
          <div className="record-row" key={m.id}>
            <button className="record-main" onClick={() => setSelected(m)}>
              <strong>{format(m.date, "dd MMM yyyy")}</strong>
              <small>
                {Object.keys(measurementValues(m)).length}{" "}
                {ar ? "قياس" : "measurements"} · {m.notes}
              </small>
            </button>
            <button className="btn" onClick={() => open(m)}>
              {ar ? "تعديل" : "Edit"}
            </button>
            <button
              className="btn"
              onClick={() => {
                if (confirm(ar ? "حذف هذا القياس؟" : "Delete this check-in?"))
                  void deleteMeasurement(m.id)
                    .then(() => setSelected(undefined))
                    .catch((e) => setError(String(e)));
              }}
            >
              {ar ? "حذف" : "Delete"}
            </button>
          </div>
        ))}
      </section>
      {editing !== undefined && (
        <Sheet
          title={ar ? "المتابعة الأسبوعية" : "Weekly check-in"}
          onClose={() => setEditing(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              {ar ? "التاريخ" : "Date"}
              <input
                required
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <p className="muted">
              {ar
                ? "اترك القيم غير المقاسة فارغة. الدهون إدخال يدوي فقط."
                : "Leave unmeasured values blank. Body-fat percentage is manually entered, never estimated."}
            </p>
            <div className="checkin-fields">
              {measurementFields.map(([key, en, arabic, unit]) => {
                const diff = difference(values[key], prev[key]);
                return (
                  <label key={key} className="checkin-field">
                    <span>
                      {ar ? arabic : en}
                      <small>
                        {ar ? "السابق" : "Previous"}: {prev[key] ?? "—"} {unit}
                      </small>
                    </span>
                    <input
                      aria-label={ar ? arabic : en}
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max={key === "bodyFat" ? 100 : 1000}
                      step="0.1"
                      placeholder={unit}
                      value={values[key] ?? ""}
                      onChange={(e) => {
                        const next = { ...values };
                        if (e.target.value === "") delete next[key];
                        else next[key] = Number(e.target.value);
                        setValues(next);
                      }}
                    />
                    <output>
                      {diff ? signed(diff.absolute) : "—"}
                      <small>{unit}</small>
                    </output>
                  </label>
                );
              })}
            </div>
            <label>
              {ar ? "ملاحظات" : "Notes"}
              <textarea
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button
              className="btn btn-primary full-width sticky-action"
              disabled={saving}
            >
              {saving
                ? ar
                  ? "جار الحفظ…"
                  : "Saving…"
                : ar
                  ? "حفظ ومقارنة"
                  : "Save & compare"}
            </button>
          </form>
        </Sheet>
      )}
      {selected && comparisons && (
        <Sheet
          title={format(selected.date, "dd MMM yyyy")}
          onClose={() => setSelected(undefined)}
        >
          {Object.entries(comparisons).map(([period, comparison]) => (
            <section className="comparison-block" key={period}>
              <h3>
                {
                  (
                    {
                      previous: ar ? "السابق" : "Previous check-in",
                      days30: ar ? "٣٠ يوم" : "30 days",
                      days90: ar ? "٩٠ يوم" : "90 days",
                      first: ar ? "أول قياس" : "First record",
                    } as Record<string, string>
                  )[period]
                }
              </h3>
              <p className="muted">
                {comparison.date
                  ? format(comparison.date, "dd MMM yyyy")
                  : ar
                    ? "لا توجد بيانات مرجعية"
                    : "No baseline recorded"}
              </p>
              {Object.entries(comparison.changes).map(
                ([key, d]) =>
                  d && (
                    <div className="record-row" key={key}>
                      <span>
                        {measurementFields.find((f) => f[0] === key)?.[
                          ar ? 2 : 1
                        ] || key}
                      </span>
                      <strong>
                        {signed(d.absolute)} ·{" "}
                        {d.percentage === null
                          ? "—"
                          : `${signed(d.percentage)}%`}
                      </strong>
                    </div>
                  ),
              )}
            </section>
          ))}
          <h3>{ar ? "الفرق بين اليسار واليمين" : "Left / right balance"}</h3>
          <p className="muted">
            {ar
              ? "وصف القياسات فقط، وليس تقييماً طبياً."
              : "A description of recorded measurements, not a medical assessment."}
          </p>
          {symmetry(selected)
            .filter((s) => s.gap !== null)
            .map((s) => {
              const baseline = measurements
                .filter((m) => m.date < selected.date)
                .at(-1);
              const old = baseline
                ? symmetry(baseline).find((p) => p.left === s.left)?.gap
                : null;
              return (
                <div className="record-row" key={s.left}>
                  <span>
                    {
                      measurementFields.find((f) => f[0] === s.left)?.[
                        ar ? 2 : 1
                      ]
                    }
                  </span>
                  <strong>
                    {s.gap?.toFixed(1)} cm{" "}
                    <small>
                      {old != null ? ` (${signed(s.gap! - old)} cm)` : ""}
                    </small>
                  </strong>
                </div>
              );
            })}
          <p>{selected.notes}</p>
        </Sheet>
      )}
    </div>
  );
}
