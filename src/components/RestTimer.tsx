import { useEffect, useState } from "react";
import { useWorkoutStore } from "../store/useWorkoutStore";
import { useLanguageStore } from "../store/useLanguageStore";
export function RestTimer({ defaultSeconds }: { defaultSeconds: number }) {
  const ends = useWorkoutStore((s) => s.activeSession?.restEndsAt),
    setEnd = useWorkoutStore((s) => s.setRestEndsAt),
    ar = useLanguageStore((s) => s.lang) === "ar";
  const [now, setNow] = useState(Date.now),
    [paused, setPaused] = useState(defaultSeconds);
  useEffect(() => {
    if (!ends) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [ends]);
  const seconds = ends ? Math.max(0, Math.ceil((ends - now) / 1000)) : paused;
  const start = (s: number) => {
    setNow(Date.now());
    setEnd(Date.now() + s * 1000);
  };
  return (
    <div className="panel">
      <p>{ar ? "الراحة" : "Rest"}</p>
      <output style={{ display: "block", fontSize: "2rem" }}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </output>
      <button
        className="btn full-width"
        onClick={() => {
          if (ends) {
            setPaused(seconds || defaultSeconds);
            setEnd(null);
          } else start(paused);
        }}
      >
        {ends
          ? seconds
            ? ar
              ? "إيقاف مؤقت"
              : "Pause"
            : ar
              ? "انتهت الراحة"
              : "Rest complete"
          : ar
            ? "ابدأ"
            : "Start"}
      </button>
      <div className="row">
        {[45, 60, 90, 120, 180].map((s) => (
          <button className="btn" key={s} onClick={() => start(s)}>
            {s}s
          </button>
        ))}
      </div>
    </div>
  );
}
