import { useEffect, useRef, useState } from "react";

const COLORS = ["#f43f5e", "#fb7185", "#fda4af", "#ffffff", "#fbbf24", "#4ade80", "#60a5fa", "#c084fc"];

export default function DoodleCanvas({ onSend }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(5);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    const canvas = ref.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 320 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#101014";
    ctx.fillRect(0, 0, rect.width, 320);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e) {
    const canvas = ref.current;
    const r = canvas.getBoundingClientRect();
    if (e.touches?.[0]) {
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    }
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function stroke(to) {
    const ctx = ref.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
  }

  function clear() {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const r = canvas.getBoundingClientRect();
    ctx.fillStyle = "#101014";
    ctx.fillRect(0, 0, r.width, 320);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-line bg-[#101014]">
        <canvas
          ref={ref}
          className="doodle-surface block h-[320px] w-full"
          onMouseDown={(e) => { drawing.current = true; last.current = pos(e); }}
          onMouseMove={(e) => { if (drawing.current) stroke(pos(e)); }}
          onMouseUp={() => { drawing.current = false; }}
          onMouseLeave={() => { drawing.current = false; }}
          onTouchStart={(e) => { drawing.current = true; last.current = pos(e); }}
          onTouchMove={(e) => { e.preventDefault(); if (drawing.current) stroke(pos(e)); }}
          onTouchEnd={() => { drawing.current = false; }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`color ${c}`}
            className={`h-8 w-8 shrink-0 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
        <div className="ml-2 flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-400">size</span>
          <input type="range" min={2} max={18} value={size} onChange={(e) => setSize(+e.target.value)} className="w-24 accent-rose-500" />
        </div>
        <button onClick={clear} className="ml-auto shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-zinc-300">
          clear
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="caption it… e.g. good morning ☀️"
          className="flex-1 rounded-xl border border-line bg-coal px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
        />
        <button
          onClick={() => {
            const img = ref.current.toDataURL("image/png");
            onSend(img, caption);
            setCaption("");
            clear();
          }}
          className="btn-love rounded-xl px-5 py-2.5 text-sm"
        >
          send 🌸
        </button>
      </div>
    </div>
  );
}
