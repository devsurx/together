import { useEffect, useState } from "react";

const STAGES = ["waking the lilies…", "picking today's prompt…", "syncing two hearts…"];

const PETALS = [
  { l: "12%", d: "0s", c: "🌸" },
  { l: "78%", d: "0.7s", c: "🏵️" },
  { l: "30%", d: "1.2s", c: "💗" },
  { l: "62%", d: "0.3s", c: "🌺" },
  { l: "48%", d: "1s", c: "🌸" },
];

export default function Splash({ quote }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 550);
    const t2 = setTimeout(() => setStage(2), 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-ink px-8 text-center">
      {/* ambient glow + falling petals (all screen sizes) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_30%,rgba(244,63,94,0.16),transparent_70%)]" />
        {PETALS.map((p, i) => (
          <span key={i} className="petal" style={{ left: p.l, animationDelay: p.d }}>
            {p.c}
          </span>
        ))}
      </div>

      <img
        src="/lily.svg"
        alt="lily"
        width={96}
        height={96}
        className="anim-lily-bloom relative"
        draggable={false}
      />
      <h1 className="font-display relative mt-6 text-5xl text-rose-50">together</h1>
      <p className="anim-bloom-in relative mt-4 max-w-xs text-sm italic leading-relaxed text-rose-200/90">
        “{quote}”
      </p>

      <div className="relative mt-8 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-300 transition-all duration-500"
          style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
        />
      </div>
      <p
        key={stage}
        className="anim-bloom-in relative mt-3 text-[11px] uppercase tracking-[0.25em] text-zinc-500"
      >
        {STAGES[stage]}
      </p>
    </div>
  );
}
