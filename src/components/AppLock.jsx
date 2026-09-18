import { useEffect, useState } from "react";

// 4-digit PIN pad with dots. Calls onPin(pin) once 4 digits are entered.
export function PinPad({ onPin }) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (pin.length === 4) {
      const t = setTimeout(() => {
        onPin(pin);
        setPin("");
      }, 180);
      return () => clearTimeout(t);
    }
  }, [pin, onPin]);

  const press = (d) => {
    if (pin.length < 4) setPin(pin + d);
  };

  return (
    <div>
      <div className="flex justify-center gap-3 py-4">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border transition-all ${
              i < pin.length ? "border-transparent bg-gradient-to-br from-rose-500 to-pink-500 scale-110" : "border-zinc-600"
            }`}
          />
        ))}
      </div>
      <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((k) => (
          <button
            key={k}
            onClick={() => {
              if (k === "clear") setPin("");
              else if (k === "back") setPin(pin.slice(0, -1));
              else press(k);
            }}
            className="rounded-2xl border border-line bg-coal py-3 text-lg font-bold text-zinc-100 active:scale-90 active:border-rose-500"
          >
            {k === "clear" ? "✕" : k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>
    </div>
  );
}

// Full-screen gate shown while the app is locked.
export function LockScreen({ attempt, error, onPin, onErase }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-8 text-center">
      <img src="/lily.svg" alt="lily" width={64} height={64} draggable={false} />
      <h1 className="font-display title-gradient mt-4 text-4xl">together</h1>
      <p className="mt-2 text-sm text-zinc-400">locked 🔒 enter your PIN</p>
      <div key={attempt} className={error ? "anim-shake w-full max-w-xs" : "w-full max-w-xs"}>
        <PinPad onPin={onPin} />
        {error ? (
          <p className="mt-2 text-xs font-semibold text-red-300">{error}</p>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-600">only you can open this 💗</p>
        )}
      </div>
      <button
        onClick={() => {
          if (window.confirm("Forgot your PIN? This erases EVERYTHING on this phone and starts over. Continue?")) onErase();
        }}
        className="mt-8 text-[11px] text-zinc-600 underline underline-offset-4"
      >
        forgot PIN? erase everything
      </button>
    </div>
  );
}

// Settings block: set / change / turn off / lock now.
export function LockSettings({ enabled, verify, onEnable, onDisable, onLockNow }) {
  const [mode, setMode] = useState("idle"); // idle | set1 | set2 | check | change1 | change2
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("idle");
    setFirst("");
    setErr("");
    setBusy(false);
  };

  const handlePin = async (pin) => {
    if (busy) return;
    if (mode === "set1" || mode === "change1") {
      setFirst(pin);
      setMode(mode === "set1" ? "set2" : "change2");
      return;
    }
    if (mode === "set2" || mode === "change2") {
      if (pin !== first) {
        setErr("PINs didn't match — start over");
        setFirst("");
        setMode(mode === "set2" ? "set1" : "change1");
        return;
      }
      setBusy(true);
      await onEnable(pin);
      reset();
      return;
    }
    // check (turn off) or pre-change verify
    setBusy(true);
    const ok = await verify(pin);
    setBusy(false);
    if (!ok) {
      setErr("Wrong PIN — try again");
      return;
    }
    if (mode === "check") {
      await onDisable();
      reset();
    } else {
      setErr("");
      setMode("change1");
    }
  };

  if (mode === "idle") {
    return (
      <div className="mt-2 flex gap-2">
        {!enabled && (
          <button
            onClick={() => { setErr(""); setMode("set1"); }}
            className="btn-love flex-1 rounded-xl py-2 text-xs"
          >
            set app lock 🔒
          </button>
        )}
        {enabled && (
          <>
            <button onClick={onLockNow} className="btn-love flex-1 rounded-xl py-2 text-xs">
              lock now 🔒
            </button>
            <button
              onClick={() => { setErr(""); setMode("change0"); }}
              className="flex-1 rounded-xl border border-line py-2 text-xs text-zinc-300"
            >
              change
            </button>
            <button
              onClick={() => { setErr(""); setMode("check"); }}
              className="flex-1 rounded-xl border border-line py-2 text-xs text-zinc-300"
            >
              turn off
            </button>
          </>
        )}
      </div>
    );
  }

  const titles = {
    set1: "Choose a 4-digit PIN",
    set2: "Enter it again to confirm",
    check: "Enter your PIN to turn off",
    change0: "Enter your current PIN",
    change1: "Choose a new 4-digit PIN",
    change2: "Enter the new one again",
  };

  return (
    <div className="mt-2 rounded-xl border border-line bg-ink p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-200">{titles[mode]}</span>
        <button onClick={reset} className="text-[11px] text-zinc-500 underline underline-offset-4">
          cancel
        </button>
      </div>
      {err ? <p className="mt-1 text-[11px] font-semibold text-red-300">{err}</p> : null}
      <PinPad onPin={handlePin} />
    </div>
  );
}
