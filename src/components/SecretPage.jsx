import { useEffect, useMemo, useState } from "react";
import LilyBloom from "./LilyBloom.jsx";
import { loadState, saveState } from "../lib/store.js";

const NOTE =
  "Hi Aishwarya ✨\n\nThis tiny corner of the internet is only yours.\nSame sky, same stars — same us. 💛\n\n— forever yours";

const REASONS = [
  "Your laugh fixes bad days. ☀️",
  "You make a thousand miles feel small. 🌙",
  "Home is wherever you are. 🏠",
  "You believe in us on the hard days. 💪",
  "Every good morning text. Every single one. 💌",
];

const BURST = ["💛", "💖", "✨", "🌟", "💗", "⭐"];

function useHugs() {
  const [hugs, setHugs] = useState(() => {
    try {
      return Number(localStorage.getItem("together.hugs") || 0);
    } catch {
      return 0;
    }
  });
  const add = () => {
    setHugs((h) => {
      const n = h + 1;
      try {
        localStorage.setItem("together.hugs", String(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  };
  return [hugs, add];
}

// A hidden surprise at /aishwarya — always a golden night sky,
// no matter which app theme is active.
export default function SecretPage() {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [step, setStep] = useState("main"); // main | theme
  const [hugs, addHug] = useHugs();
  const done = typed.length >= NOTE.length;

  // Entering the app from here: save the chosen sky, then go in.
  const chooseTheme = (theme) => {
    try {
      const s = loadState();
      s.theme = theme;
      saveState(s);
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  };

  useEffect(() => {
    document.title = "for Aishwarya 💛";
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(NOTE.slice(0, i));
      if (i >= NOTE.length) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, []);

  const stars = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() < 0.85 ? 2 : 3,
        delay: Math.random() * 3,
        dur: 2 + Math.random() * 2.5,
        gold: Math.random() < 0.3,
      })),
    []
  );

  const burst = useMemo(() => {
    if (!burstKey) return [];
    return Array.from({ length: 16 }, (_, i) => ({
      id: `${burstKey}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      char: BURST[i % BURST.length],
    }));
  }, [burstKey]);

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#070b18] px-6 py-14 text-center">
      {/* night sky */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_0%,rgba(245,158,11,0.16),transparent_70%)]" />
        {stars.map((s) => (
          <span
            key={s.id}
            className="twinkle-star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
              background: s.gold ? "#fde68a" : "#fff",
              boxShadow: s.gold ? "0 0 6px #fcd34d" : undefined,
            }}
          />
        ))}
        <div className="shoot" />
      </div>
      {burstKey > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {burst.map((p) => (
            <span key={p.id} className="petal" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s` }}>
              {p.char}
            </span>
          ))}
        </div>
      )}

      <div className="anim-bloom-in relative mx-auto w-full max-w-sm">
        <div className="flex justify-center">
          <LilyBloom size={110} />
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.35em] text-amber-200/70">
          a sky full of stars, one name
        </div>

        <p
          className={`mt-5 whitespace-pre-line font-display text-xl italic leading-relaxed text-amber-50 ${done ? "" : "type-caret"}`}
        >
          {typed}
        </p>

        {done && (
          <div className="anim-bloom-in">
            <div className="mt-8 rounded-3xl border border-amber-200/20 bg-white/5 p-5 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-200/80">
                reasons, no. {reason + 1}
              </div>
              <p key={reason} className="anim-bloom-in font-display mt-2 text-lg text-amber-50">
                “{REASONS[reason]}”
              </p>
              <button
                onClick={() => setReason((r) => (r + 1) % REASONS.length)}
                className="mt-3 rounded-full border border-amber-200/30 px-4 py-1.5 text-xs font-semibold text-amber-100"
              >
                one more ⟳
              </button>
            </div>

            <button
              onClick={() => {
                addHug();
                setBurstKey((k) => k + 1);
              }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-bold text-amber-950 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.7)] active:scale-[0.98]"
            >
              send a hug 🤗
            </button>
            <p className="mt-2 text-[11px] text-amber-100/60">
              {hugs === 0 ? "no hugs yet — fix that 👆" : `${hugs} hug${hugs === 1 ? "" : "s"} collected 💛`}
            </p>

            {step === "main" ? (
              <button
                onClick={() => setStep("theme")}
                className="mt-8 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-bold text-amber-950 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.7)] active:scale-[0.98]"
              >
                Next →
              </button>
            ) : (
              <div className="anim-bloom-in mt-8">
                <p className="text-sm text-amber-100/80">One last thing — how should our sky look?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => chooseTheme("lilies")}
                    className="rounded-3xl border border-rose-200/30 bg-white/5 p-5 backdrop-blur active:scale-95"
                  >
                    <div className="text-4xl">🌸</div>
                    <div className="mt-2 text-sm font-bold text-rose-50">Lilies</div>
                    <div className="text-[11px] text-zinc-400">soft & romantic</div>
                  </button>
                  <button
                    onClick={() => chooseTheme("stars")}
                    className="rounded-3xl border border-amber-200/30 bg-white/5 p-5 backdrop-blur active:scale-95"
                  >
                    <div className="text-4xl">🌟</div>
                    <div className="mt-2 text-sm font-bold text-amber-50">Starry night</div>
                    <div className="text-[11px] text-zinc-400">golden & dreamy</div>
                  </button>
                </div>
                <button
                  onClick={() => setStep("main")}
                  className="mt-4 text-xs text-amber-100/50 underline underline-offset-4"
                >
                  ← back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
