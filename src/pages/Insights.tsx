import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { format, getDay, parseISO } from "date-fns";
import {
  loadAnalytics,
  heatValue,
  type DateRange,
  type HeatMetric,
} from "../services/analytics";
import { useUserStore } from "../store/useUserStore";
import { useLanguageStore } from "../store/useLanguageStore";
import { nutrientUnits, type Nutrient } from "../food/model";
import { measurementValues } from "../services/measurements";
import { Sheet } from "../components/Sheet";
const number = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
export default function Insights() {
  const ar = useLanguageStore((s) => s.lang) === "ar",
    userId = useUserStore((s) => s.activeUserId) || "default_user";
  const [range, setRange] = useState<DateRange>("90d"),
    [metric, setMetric] = useState<HeatMetric>("workout"),
    [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly"),
    [selected, setSelected] = useState("");
  const result = useLiveQuery(async () => {
    try {
      return { data: await loadAnalytics(userId, range), error: "" };
    } catch (e) {
      return { error: String(e) };
    }
  }, [userId, range]);
  const data = result?.data,
    day = data?.days.find((d) => d.date === selected);
  const labels: Record<HeatMetric, string> = {
    workout: ar ? "التمارين" : "Workouts",
    calories: ar ? "السعرات" : "Calories",
    protein: ar ? "البروتين" : "Protein",
    nutrition: ar ? "الالتزام الغذائي" : "Nutrition adherence",
    hydration: ar ? "الماء" : "Hydration",
    measurements: ar ? "القياسات" : "Check-ins",
    activity: ar ? "النشاط العام" : "Overall activity",
  };
  return (
    <div className="journal-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            {ar ? "صورة أوضح لجهدك" : "A CLEARER VIEW OF YOUR EFFORT"}
          </span>
          <h1>{ar ? "التحليلات" : "Insights"}</h1>
          <p>
            {ar
              ? "من سجلاتك الفعلية، دون تخمين."
              : "From your real records. No guesses."}
          </p>
        </div>
        <select
          aria-label="Date range"
          value={range}
          onChange={(e) => setRange(e.target.value as DateRange)}
        >
          {(["7d", "30d", "90d", "6m", "1y", "all"] as const).map((r) => (
            <option value={r} key={r}>
              {r === "all" ? (ar ? "الكل" : "All time") : r}
            </option>
          ))}
        </select>
      </header>
      <nav className="quick-links">
        <Link to="/calendar">{ar ? "التقويم" : "Calendar"}</Link>
        <Link to="/measurements">{ar ? "القياسات" : "Measurements"}</Link>
        <Link to="/progress">{ar ? "الصور والتقدم" : "Photos & progress"}</Link>
        <Link to="/muscles">{ar ? "خريطة العضلات" : "Muscle map"}</Link>
      </nav>
      {!result && (
        <div className="skeleton" role="status">
          {ar ? "جار قراءة سجلاتك…" : "Reading your journal…"}
        </div>
      )}
      {result?.error && <p role="alert">{result.error}</p>}
      {data && (
        <>
          <section className="metric-grid panel">
            <div>
              <small>{ar ? "تمرين / أسبوع" : "Sessions / week"}</small>
              <strong>{number(data.frequency)}</strong>
            </div>
            <div>
              <small>{ar ? "التتابع الحالي" : "Current streak"}</small>
              <strong>
                {data.streak.current}
                <span> {ar ? "يوم" : "days"}</span>
              </strong>
              <small>
                {ar ? "الأطول" : "Best"} {data.streak.longest}
              </small>
            </div>
            <div>
              <small>{ar ? "جلسات فائتة" : "Missed sessions"}</small>
              <strong>{data.missed}</strong>
            </div>
            <div>
              <small>{ar ? "من آخر قياس" : "Since check-in"}</small>
              <strong>
                {data.daysSinceCheckIn ?? "—"}
                <span> {ar ? "يوم" : "days"}</span>
              </strong>
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>{ar ? "تقدم الجسم" : "Body progress"}</h2>
              <Link to="/measurements">
                {ar ? "فتح القياسات" : "Open measurements"}
              </Link>
            </div>
            {!data.weight.length && !data.body.length ? (
              <p className="empty-state">
                {ar
                  ? "سجّل وزنك أو قياساتك لعرض التغير هنا."
                  : "Log weight or measurements to see changes here."}
              </p>
            ) : (
              <div className="metric-grid">
                <div>
                  <small>{ar ? "آخر وزن" : "Latest weight"}</small>
                  <strong>
                    {data.weight.at(-1)
                      ? `${number(data.weight.at(-1)!.weight)} kg`
                      : "—"}
                  </strong>
                  {data.weight.length > 1 && (
                    <small>
                      {number(
                        data.weight.at(-1)!.weight - data.weight[0].weight,
                      )}{" "}
                      kg ·{" "}
                      {number(
                        ((data.weight.at(-1)!.weight - data.weight[0].weight) /
                          data.weight[0].weight) *
                          100,
                      )}
                      %
                    </small>
                  )}
                </div>
                <div>
                  <small>{ar ? "جلسات القياس" : "Measurement check-ins"}</small>
                  <strong>{data.body.length}</strong>
                  <small>
                    {data.body.at(-1)
                      ? format(data.body.at(-1)!.date, "dd MMM yyyy")
                      : "—"}
                  </small>
                </div>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>{ar ? "خريطة النشاط" : "Activity map"}</h2>
              <select
                aria-label="Heatmap metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as HeatMetric)}
              >
                {Object.entries(labels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <p className="muted">
              {ar
                ? "اضغط على يوم لعرض سجلاته. درجة النشاط مقياس استخدام للتطبيق وليست إرشاداً طبياً."
                : "Tap a day to inspect its records. Activity score measures app activity, not health."}
            </p>
            <div className="heatmap-scroll">
              <div className="heatmap" role="group" aria-label={labels[metric]}>
                {Array.from(
                  { length: (getDay(parseISO(data.days[0].date)) + 6) % 7 },
                  (_, i) => (
                    <span key={`pad-${i}`} />
                  ),
                )}
                {data.days.map((d) => {
                  const v = heatValue(d, metric),
                    max =
                      metric === "workout"
                        ? 3
                        : metric === "calories"
                          ? 2500
                          : metric === "protein"
                            ? 150
                            : metric === "hydration"
                              ? 3000
                              : metric === "measurements"
                                ? 1
                                : 100;
                  const level =
                    v === 0
                      ? 0
                      : Math.min(4, Math.max(1, Math.ceil((v / max) * 4)));
                  return (
                    <button
                      className={`heat-cell heat-${level}`}
                      key={d.date}
                      title={`${d.date}: ${number(v)}`}
                      aria-label={`${d.date} ${labels[metric]} ${number(v)}`}
                      onClick={() => setSelected(d.date)}
                    />
                  );
                })}
              </div>
            </div>
            <div className="heat-legend">
              <span>{data.days[0].date}</span>
              <span>
                {ar ? "أقل" : "Less"} ░ ▒ ▓ █ {ar ? "أكثر" : "More"}
              </span>
              <span>{data.days.at(-1)?.date}</span>
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>{ar ? "ملخص السجل" : "Journal summary"}</h2>
              <select
                value={period}
                aria-label="Summary period"
                onChange={(e) => setPeriod(e.target.value as typeof period)}
              >
                <option value="daily">{ar ? "يومي" : "Daily"}</option>
                <option value="weekly">{ar ? "أسبوعي" : "Weekly"}</option>
                <option value="monthly">{ar ? "شهري" : "Monthly"}</option>
              </select>
            </div>
            <p className="muted">
              {ar
                ? "المتوسطات الغذائية للأيام المسجلة فقط. القيم المفقودة غير معروفة."
                : "Nutrition averages include days with recorded values only. Missing nutrients are unknown; partial days may be incomplete."}
            </p>
            <div className="volume-chart" aria-label="Workout volume trend">
              {data[period].map((p) => (
                <div key={p.date} title={`${p.date}: ${number(p.volume)} kg`}>
                  <span
                    style={{
                      height: `${Math.max(2, (120 * p.volume) / Math.max(1, ...data[period].map((r) => r.volume)))}px`,
                    }}
                  />
                  <small>{p.date.slice(5)}</small>
                </div>
              ))}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      ar ? "الفترة" : "Period",
                      ar ? "تمارين" : "Workouts",
                      ar ? "المكتمل / المخطط" : "Done / planned",
                      ar ? "مجموعات / عدات" : "Sets / reps",
                      ar ? "الحجم كجم" : "Volume kg",
                      ar ? "الماء مل/يوم" : "Water ml/day",
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data[period]].reverse().map((p) => (
                    <tr key={p.date}>
                      <th>{p.date}</th>
                      <td>{p.workouts}</td>
                      <td>
                        {p.completed} / {p.planned}
                      </td>
                      <td>
                        {p.sets} / {p.reps}
                      </td>
                      <td>{number(p.volume)}</td>
                      <td>{number(p.hydrationAverage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>
                {ar
                  ? "متوسطات المغذيات لكل فترة"
                  : "Nutrient averages by period"}
              </summary>
              {[...data[period]]
                .reverse()
                .filter((p) => p.loggedDays)
                .map((p) => (
                  <div key={p.date}>
                    <h3>{p.date}</h3>
                    <div className="nutrient-list">
                      {Object.entries(p.averages).map(([k, v]) => (
                        <div key={k}>
                          <span>{k}</span>
                          <strong>
                            {number(v!)} {nutrientUnits[k as Nutrient]}
                            <small>
                              {" "}
                              · {p.nutrientDays[k as Nutrient]}{" "}
                              {ar ? "أيام" : "days"}
                            </small>
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </details>
          </section>
          <section className="panel">
            <h2>{ar ? "مجموعات العضلات" : "Muscle groups"}</h2>
            {!Object.keys(data.muscle).length && (
              <p className="empty-state">
                {ar
                  ? "أكمل تمريناً لرؤية بياناتك."
                  : "Finish a workout to see your training data."}
              </p>
            )}
            {Object.entries(data.muscle).map(([name, m]) => (
              <div className="record-row" key={name}>
                <strong>{name}</strong>
                <span>
                  {m.sessions} {ar ? "جلسات" : "sessions"} · {m.sets}{" "}
                  {ar ? "مجموعات" : "sets"} · {number(m.volume)} kg
                </span>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>
              {ar
                ? "تطور التمارين والأرقام الشخصية"
                : "Exercise progression & personal records"}
            </h2>
            {Object.entries(data.exercise).map(([id, e]) => (
              <details key={id}>
                <summary>
                  {e.name} · {e.sessions} {ar ? "جلسات" : "sessions"} ·{" "}
                  {number(e.volume)} kg
                </summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{ar ? "التاريخ" : "Date"}</th>
                        <th>{ar ? "أعلى وزن" : "Top weight"}</th>
                        <th>{ar ? "تقدير 1RM" : "Estimated 1RM"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.progression.map((p, i) => (
                        <tr key={i}>
                          <td>{format(p.date, "dd MMM")}</td>
                          <td>{p.weight} kg</td>
                          <td>
                            {number(p.est1RM)} kg{" "}
                            {data.prs.some(
                              (r) => r.exerciseId === id && r.date === p.date,
                            )
                              ? "★"
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </section>
          <section className="panel">
            <h2>{ar ? "الالتزام اليومي" : "Daily adherence"}</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th>{ar ? "السعرات" : "Calories"}</th>
                    <th>{ar ? "الماء" : "Water"}</th>
                    <th>
                      {ar
                        ? "جرعات المكملات المسجلة"
                        : "Recorded supplement doses"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.days]
                    .reverse()
                    .filter((d) => d.log)
                    .map((d) => (
                      <tr key={d.date}>
                        <td>
                          <button onClick={() => setSelected(d.date)}>
                            {d.date}
                          </button>
                        </td>
                        <td>
                          {d.nutritionAdherence === null
                            ? "—"
                            : `${Math.round(d.nutritionAdherence * 100)}%`}
                        </td>
                        <td>
                          {d.hydrationAdherence === null
                            ? "—"
                            : `${Math.round(d.hydrationAdherence * 100)}%`}
                        </td>
                        <td>
                          {d.supplementsTaken} / {d.supplementsExpected ?? "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              {ar
                ? "الجرعات المتوقعة حسب الخطة المحفوظة في ذلك اليوم. الأيام القديمة دون خطة غير معروفة."
                : "Expected doses use the plan saved on that date. Older days without a saved plan are unknown."}
            </p>
          </section>
        </>
      )}
      {day && (
        <Sheet title={day.date} onClose={() => setSelected("")}>
          <h3>{ar ? "التمارين" : "Workouts"}</h3>
          <p>
            {day.workouts.length} · {day.sets} {ar ? "مجموعات" : "sets"} ·{" "}
            {day.reps} {ar ? "عدات" : "reps"} · {number(day.volume)} kg
          </p>
          {day.workouts.map((w) => (
            <details key={w.sessionId} open>
              <summary>
                {w.type} ·{" "}
                {Math.round(((w.finishedAt || w.date) - w.date) / 60000)} min
              </summary>
              {w.exercises.map((e, i) => (
                <div key={i} className="comparison-block">
                  <strong>
                    {data?.exercise[e.exerciseId]?.name || e.exerciseId}
                  </strong>
                  <p>
                    {e.sets
                      .map(
                        (s) =>
                          `${s.completed ? "✓" : "○"} ${s.reps} × ${s.weight}kg`,
                      )
                      .join(" · ")}
                  </p>
                  <p>{e.notes}</p>
                </div>
              ))}
            </details>
          ))}
          <h3>{ar ? "الوجبات" : "Meals"}</h3>
          {day.log?.meals.map((m) => (
            <div key={m.type}>
              <h4>{m.type}</h4>
              {m.foods.map((f, i) => (
                <div className="record-row" key={f.id || i}>
                  <span>{f.name}</span>
                  <strong>
                    {f.amount} {f.unit}
                  </strong>
                </div>
              ))}
            </div>
          ))}
          <h3>{ar ? "المغذيات المسجلة" : "Recorded nutrients"}</h3>
          <div className="nutrient-list">
            {Object.entries(day.nutrients).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>
                  {number(value!)} {nutrientUnits[key as Nutrient]}
                </strong>
              </div>
            ))}
          </div>
          <p>
            {ar ? "الماء" : "Water"}: {day.water} ml
          </p>
          <h3>{ar ? "المكملات" : "Supplements"}</h3>
          {Object.entries(day.log?.supplementsTaken || {}).map(
            ([id, doses]) => (
              <p key={id}>
                {day.log?.supplementPlan?.[id]?.name || id}:{" "}
                {doses.map((d) => (d ? "✓" : "○")).join(" ")}
              </p>
            ),
          )}
          <h3>{ar ? "الوزن والقياسات" : "Weight & measurements"}</h3>
          {day.weight.map((w, i) => (
            <p key={i}>{w.weight} kg</p>
          ))}
          {day.measurements.map((m) => (
            <div key={m.id}>
              {Object.entries(measurementValues(m)).map(([key, v]) => (
                <p key={key}>
                  {key}: {v}
                </p>
              ))}
              <p>{m.notes}</p>
            </div>
          ))}
          {!day.log &&
            !day.workouts.length &&
            !day.measurements.length &&
            !day.weight.length && (
              <p className="empty-state">
                {ar ? "لا يوجد سجل لهذا اليوم." : "No records for this day."}
              </p>
            )}
        </Sheet>
      )}
    </div>
  );
}
