import { useState } from "react";

const STEPS = [
  {
    art: "🌸",
    title: "One prompt a day",
    text: "You both get the same question every morning. Answers stay locked until you've both responded — then they bloom open together.",
  },
  {
    art: "😊",
    title: "Tap your mood, grow the streak",
    text: "One emoji check-in each. When you both check in on the same day, your streak grows by one. Miss a day? You get one grace save.",
  },
  {
    art: "💓",
    title: "Feel close, instantly",
    text: "Buzz them with Thinking-of-you, light your shared lamp, trade a song — tiny touches for the hours between calls.",
  },
  {
    art: "✍️",
    title: "Scribble & countdown",
    text: "Send quick doodles to the scrapbook, count down to your next visit, and collect points toward real plans together.",
  },
  {
    art: "📲",
    title: "Keep it on your home screen",
    text: "Install Together like a real app and set a daily reminder — the whole ritual takes under a minute. Ready?",
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
