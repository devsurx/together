import { useState } from "react";

const STEPS = [
  {
    art: "🌸",
    title: "One prompt a day",
    text: "You both get the same question every morning. Nobody can peek. Once you've both answered, they open up together.",
  },
  {
    art: "😊",
    title: "Tap your mood, grow the streak",
    text: "One emoji check-in each. Do it on the same day and the streak grows. Slip once and you're forgiven.",
  },
  {
    art: "💓",
    title: "Feel close, instantly",
    text: "Buzz them when they're on your mind. Light the lamp. Send a silly little doodle. Small stuff for the hours between calls.",
  },
  {
    art: "✍️",
    title: "Scribble & countdown",
    text: "Keep a shared wall of scribbles. Count down the days till you're together again.",
  },
  {
    art: "📲",
    title: "Keep it on your home screen",
    text: "Add it to your home screen and set a daily reminder. The whole thing takes under a minute. Ready?",
  },
];

export default function Onboarding({ onClose }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const s = STEPS[i];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        key={i}
        className="anim-bloom-in w-full max-w-sm rounded-[2rem] border border-rose-500/25 bg-card p-6 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-rose-600/30 to-transparent text-4xl">
          {s.art}
        </div>

        <div className="mt-3 flex justify-center gap-1.5">
          {STEPS.map((_, d) => (
            <span
              key={d}
              className={`h-1.5 rounded-full transition-all ${
                d === i ? "w-6 bg-rose-500" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>

        <h3 className="font-display mt-3 text-2xl text-rose-50">{s.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{s.text}</p>

        <div className="mt-5 flex gap-2">
          {i > 0 && (
            <button
              onClick={() => setI(i - 1)}
              className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-zinc-300"
            >
              ← back
            </button>
          )}
          <button
            onClick={() => (last ? onClose() : setI(i + 1))}
            className="btn-love flex-1 rounded-2xl py-2.5 text-sm"
          >
            {last ? "Start our ritual 💗" : "next →"}
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-3 text-[11px] text-zinc-500 underline underline-offset-4"
        >
          skip tour
        </button>
      </div>
    </div>
  );
}
