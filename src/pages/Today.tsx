import { Link } from "react-router-dom";
import { format, startOfDay } from "date-fns";
import { useUserStore } from "../store/useUserStore";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { useNutritionStore } from "../store/useNutritionStore";
import { useMeasurementsStore } from "../store/useMeasurementsStore";
import { useLanguageStore } from "../store/useLanguageStore";
import {
  ChartNoAxesCombined,
  Droplets,
  Dumbbell,
  Ruler,
  Utensils,
} from "lucide-react";
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
      <header className="page-head today-heading">
        <time dateTime={date}>{format(new Date(), "EEEE, dd MMMM")}</time>
        <h1>{ar ? "سجّل شغلك." : "Log the work."}</h1>
        <p>
          {profile?.name
            ? ar
              ? `${profile.name}، هذه أرقامك اليوم.`
              : `${profile.name}, here is today’s record.`
            : ar
              ? "تدريبك وتغذيتك وتقدمك في مكان واحد."
              : "Training, nutrition and progress in one place."}
        </p>
      </header>
      <section className="today-hero">
        <div className="today-hero-status">
          <span>
            {active
              ? ar
                ? "محفوظ على الجهاز"
                : "Saved on device"
              : done.length
                ? ar
                  ? "مكتمل اليوم"
                  : "Completed today"
                : plan
                  ? ar
                    ? "في الجدول"
                    : "On the schedule"
                  : ar
                    ? "جاهز للبدء"
                    : "Ready to start"}
          </span>
          <strong>{done.length ? `${done.length}/1` : "00"}</strong>
        </div>
        <div className="today-hero-copy">
          <Dumbbell aria-hidden="true" size={28} strokeWidth={2.5} />
          <div>
            <h2>
              {active
                ? active.type
                : plan
                  ? plan.type
                  : done.length
                    ? ar
                      ? "تم تسجيل تمرينك"
                      : "Workout logged"
                    : ar
                      ? "اختر تمرين اليوم"
                      : "Choose today’s session"}
            </h2>
            <p>
              {active
                ? ar
                  ? "مجموعاتك محفوظة. أكمل من حيث توقفت."
                  : "Your sets are saved. Continue where you stopped."
                : done.length
                  ? ar
                    ? "تم حفظ كل مجموعة في سجلك."
                    : "Every completed set is in your record."
                  : ar
                    ? "ابدأ وسجّل الوزن والعدات أثناء التمرين."
                    : "Start, then record weight and reps as you train."}
            </p>
          </div>
        </div>
        <Link className="today-cta" to="/workout">
          <span>
            {active
              ? ar
                ? "متابعة التمرين"
                : "Resume workout"
              : plan
                ? ar
                  ? "عرض تمرين اليوم"
                  : "View today’s workout"
                : ar
                  ? "فتح التدريب"
                  : "Open training"}
          </span>
          <small>{ar ? "تمرين" : "Training"}</small>
        </Link>
      </section>
      <div
        className="today-grid"
        aria-label={ar ? "ملخص اليوم" : "Today’s summary"}
      >
        <Link className="today-stat" to="/nutrition">
          <Utensils aria-hidden="true" />
          <div>
            <span>{ar ? "الأطعمة" : "Food entries"}</span>
            <strong>
              {log?.meals.reduce((n, m) => n + m.foods.length, 0) || 0}
            </strong>
          </div>
        </Link>
        <Link className="today-stat" to="/nutrition">
          <Droplets aria-hidden="true" />
          <div>
            <span>{ar ? "الماء" : "Water"}</span>
            <strong>
              {log?.waterMl || 0}
              <small> ml</small>
            </strong>
          </div>
        </Link>
        <Link className="today-stat" to="/measurements">
          <Ruler aria-hidden="true" />
          <div>
            <span>{ar ? "آخر قياس" : "Last check-in"}</span>
            <strong>{checkIn ? format(checkIn.date, "dd MMM") : "—"}</strong>
          </div>
        </Link>
        <Link className="today-stat" to="/insights">
          <ChartNoAxesCombined aria-hidden="true" />
          <div>
            <span>{ar ? "التمارين المسجلة" : "Logged workouts"}</span>
            <strong>{history.length}</strong>
          </div>
        </Link>
      </div>
      <nav className="quick-links utility-rail">
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
