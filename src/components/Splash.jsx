import { useEffect, useMemo, useState } from "react";
import LilyBloom from "./LilyBloom.jsx";

const MESSAGES = [
  "watering the lilies…",
  "sprinkling stardust…",
  "waking the fireflies…",
  "teaching the stars your name…",
  "folding moonlight…",
  "warming up the hugs…",
];

const STARS = [
  { l: "10%", t: "18%", s: 2, d: "0s", dur: "2.6s" },
  { l: "24%", t: "72%", s: 3, d: "0.8s", dur: "3.2s" },
  { l: "82%", t: "26%", s: 2, d: "0.4s", dur: "2.2s" },
  { l: "70%", t: "80%", s: 3, d: "1.4s", dur: "3.8s" },
  { l: "45%", t: "8%", s: 2, d: "2s", dur: "2.8s" },
  { l: "8%", t: "52%", s: 2, d: "1s", dur: "3.4s" },
  { l: "92%", t: "58%", s: 2, d: "0.2s", dur: "2.4s" },
  { l: "58%", t: "90%", s: 3, d: "1.8s", dur: "3s" },
];

export default function Splash({ quote }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [450, 950, 1450].map((ms, i) => setTimeout(() => setStage(i + 1 > 2 ? 2 : i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const msg = useMemo(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)], []);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-ink px-8 text-center">
      {/* twinkling stars everywhere */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_30%,rgba(244,63,94,0.16),transparent_70%)]" />
        {STARS.map((s, i) => (
          <span
            key={i}
            className="twinkle-star"
            style={{
              left: s.l,
              top: s.t,
              width: s.s,
              height: s.s,
              animationDelay: s.d,
              animationDuration: s.dur,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <LilyBloom size={128} />
      </div>
      <h1 className="font-display title-gradient relative mt-5 text-5xl">together</h1>
      <p className="anim-bloom-in relative mt-4 max-w-xs text-sm italic leading-relaxed text-rose-200/90">
        “{quote}”
      </p>

      <div className="relative mt-8 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-300 to-amber-200 transition-all duration-500"
          style={{ width: `${((stage + 1) / 3) * 100}%` }}
        />
      </div>
      <p key={msg} className="anim-bloom-in relative mt-3 text-xs italic text-amber-100/80">
        ✨ {msg}
      </p>
    </div>
  );
}
