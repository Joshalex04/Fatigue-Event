import { useEffect, useState } from "react";

/**
 * Post-login splash: a plane appears on the horizon and flies toward the
 * viewer, growing until it passes "through" the screen, then fades out.
 */
export function PlaneSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2100);
    const t2 = setTimeout(onDone, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center overflow-hidden bg-background transition-opacity duration-400 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* horizon glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[120px]" />
      </div>

      {/* speed lines */}
      <div className="plane-speed pointer-events-none absolute inset-0" />

      {/* the plane */}
      <div className="plane-fly relative">
        <svg
          viewBox="0 0 200 200"
          className="size-40 text-foreground drop-shadow-[0_0_30px_rgba(0,120,210,0.55)]"
          fill="currentColor"
          aria-hidden
        >
          {/* top-down airplane silhouette */}
          <path d="M100 8c6 0 10 5 11 14l3 46 52 26c4 2 6 5 6 9v9l-58-16-2 40 16 12c3 2 4 4 4 7v7l-24-7h-16l-24 7v-7c0-3 1-5 4-7l16-12-2-40-58 16v-9c0-4 2-7 6-9l52-26 3-46c1-9 5-14 11-14z" />
        </svg>
      </div>

      <p className="plane-tag absolute bottom-16 font-mono text-xs tracking-[0.35em] text-muted-foreground uppercase">
        Cleared for takeoff
      </p>
    </div>
  );
}
