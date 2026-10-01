import { Link } from "react-router-dom";
import { format, startOfDay } from "date-fns";
import { useUserStore } from "../store/useUserStore";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { useNutritionStore } from "../store/useNutritionStore";
import { useMeasurementsStore } from "../store/useMeasurementsStore";
import { useLanguageStore } from "../store/useLanguageStore";
export default function Today() {
  const ar = useLanguageStore((s) => s.lang) === "ar",
    profile = useUserStore((s) => s.profile),
    active = useWorkoutStore((s) => s.activeSession),
    schedules = useWorkoutStore((s) => s.scheduledSessions),
    history = useWorkoutStore((s) => s.history);
  const date = format(new Date(), "yyyy-MM-dd"),
    plan = schedules.find((s) => s.date === date && !s.completedSessionId),
    done = history.filter(
      (w) => w.isFinished && format(w.date, "yyyy-MM-dd") === date,
    );
  const log = useNutritionStore(
    (s) => s.history[startOfDay(new Date()).getTime()],
  );
  const checkIn = useMeasurementsStore((s) => s.measurements.at(-1));
  return (
    <div className="journal-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            OMNIBODY · {format(new Date(), "EEE, dd MMM")}
          </span>
          <h1>{ar ? "يومك، بخطوة واحدة." : "One good day at a time."}</h1>
          <p>
            {profile?.name
              ? `${ar ? "أهلاً" : "Welcome"}, ${profile.name}`
              : ar
                ? "مساحتك للتدريب والتقدم"
                : "Your space to train and progress"}
          </p>
        </div>
      </header>
      <section className="today-hero">
        <span className="eyebrow">
          {active
            ? ar
              ? "تمرين محفوظ"
              : "SESSION SAVED"
            : done.length
              ? ar
                ? "أحسنت اليوم"
                : "TODAY’S TRAINING"
              : ar
                ? "خطوتك التالية"
                : "YOUR NEXT STEP"}
        </span>
        <h2>
          {active
            ? active.type
            : plan
              ? plan.type
              : done.length
                ? ar
                  ? "تم تسجيل تمرينك"
                  : "Your workout is in the journal"
                : ar
                  ? "اختر تمرين اليوم"
                  : "Make time for your training"}
        </h2>
        <p>
          {active
            ? ar
              ? "تابع من حيث توقفت. مجموعاتك محفوظة على جهازك."
              : "Pick up where you left off. Your sets are saved on this device."
            : done.length
              ? ar
                ? "إنهاء التمرين لا يبدأ تمرين الغد."
                : "Finishing a workout leaves tomorrow’s plan untouched."
              : ar
                ? "سجّل تقدمك، مجموعة تلو الأخرى."
                : "Build progress, one set at a time."}
        </p>
        <Link className="btn" to="/workout">
          {active
            ? ar
              ? "متابعة التمرين"
              : "Resume workout"
            : plan
              ? ar
                ? "عرض تمرين اليوم"
                : "View today’s workout"
              : ar
                ? "افتح التدريب"
                : "Open training"}{" "}
          →
        </Link>
      </section>
      <div className="today-grid">
        <Link className="panel" to="/nutrition">
          <span className="eyebrow">{ar ? "التغذية" : "NOURISH"}</span>
          <strong>
            {log?.meals.reduce((n, m) => n + m.foods.length, 0) || 0}
          </strong>
          <p>{ar ? "أطعمة مسجلة" : "foods logged"}</p>
          <small>{ar ? "أضف وجبتك التالية" : "Log your next meal"} →</small>
        </Link>
        <Link className="panel" to="/nutrition">
          <span className="eyebrow">{ar ? "الماء" : "HYDRATE"}</span>
          <strong>
            {log?.waterMl || 0}
            <small> ml</small>
          </strong>
          <p>{ar ? "اليوم" : "today"}</p>
          <small>{ar ? "سجّل كوباً" : "Add a glass"} →</small>
        </Link>
        <Link className="panel" to="/measurements">
          <span className="eyebrow">{ar ? "متابعة أسبوعية" : "CHECK IN"}</span>
          <strong>{checkIn ? format(checkIn.date, "dd MMM") : "—"}</strong>
          <p>{ar ? "آخر قياس" : "last measurement"}</p>
          <small>{ar ? "قِس وقارن" : "Measure & compare"} →</small>
        </Link>
        <Link className="panel" to="/insights">
          <span className="eyebrow">{ar ? "التقدم" : "REFLECT"}</span>
          <strong>{history.length}</strong>
          <p>{ar ? "تمارين في سجلك" : "workouts in your journal"}</p>
          <small>{ar ? "شاهد الاتجاهات" : "Explore your trends"} →</small>
        </Link>
      </div>
      <nav className="quick-links">
        <Link to="/calendar">{ar ? "الجدول" : "Schedule"}</Link>
        <Link to="/muscles" data-walkthrough="nav-muscles">
          {ar ? "خريطة العضلات" : "Muscle map"}
        </Link>
        <Link to="/daily-detail">
          {ar ? "الصحة والتعافي" : "Health & recovery"}
        </Link>
        <Link to="/profile">
          {ar ? "النسخ الاحتياطي والإعدادات" : "Backup & settings"}
        </Link>
      </nav>
      <p className="muted">
        {ar
          ? "بياناتك محفوظة على هذا الجهاز. أنشئ نسخة احتياطية دورياً."
          : "Your journal lives on this device. Back it up regularly."}
      </p>
    </div>
  );
}
