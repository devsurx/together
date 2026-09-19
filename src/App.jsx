import { useEffect, useMemo, useRef, useState } from "react";
import DoodleCanvas from "./components/DoodleCanvas.jsx";
import SecretPage from "./components/SecretPage.jsx";
import AdminPage from "./components/AdminPage.jsx";
import { LockScreen, LockSettings } from "./components/AppLock.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Splash from "./components/Splash.jsx";
import {
  BOOT_QUOTES,
  HOME_TZ,
  MOODS,
  STATUSES,
  bootQuote,
  promptForDate,
  todayKey,
} from "./lib/content.js";
import { isFirebaseConfigured, hasVapid, getFcmToken, onForegroundMessage, requestReminderPermission, scheduleLocalReminder } from "./lib/firebase.js";
import { fbCreatePair, fbJoinPair, fbWriteDay, fbWriteMe, fbWritePair, loadFbLink, startSync } from "./lib/sync.js";
import { hashPin, makeSalt } from "./lib/lock.js";
import { applyStreak, createPair, freshState, loadState, saveState } from "./lib/store.js";

function timeAgo(ts) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Petals({ burstKey }) {
  const petals = useMemo(() => {
    if (!burstKey) return [];
    return Array.from({ length: 14 }, (_, i) => ({
      id: `${burstKey}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      char: ["🌸", "🏵️", "💗", "🌺"][i % 4],
    }));
  }, [burstKey]);
  if (!burstKey) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {petals.map((p) => (
        <span key={p.id} className="petal" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s` }}>
          {p.char}
        </span>
      ))}
    </div>
  );
}

function Lily({ size = 40, bloom = false }) {
  return (
    <img
      src="/lily.svg"
      alt="lily"
      width={size}
      height={size}
      className={bloom ? "anim-lily-bloom" : undefined}
      draggable={false}
    />
  );
}

function SectionTitle({ kicker, title, right }) {  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/80">{kicker}</div>
        <h2 className="font-display text-xl text-rose-50">{title}</h2>
      </div>
      {right}
    </div>
  );
}

// 3 simple states; legacy values map to busy so old data still reads well.
const STATUS_META = {
  free: { dot: "bg-emerald-400", label: "free" },
  busy: { dot: "bg-amber-400", label: "busy" },
  sleeping: { dot: "bg-violet-400", label: "sleeping" },
  working: { dot: "bg-amber-400", label: "busy" },
  driving: { dot: "bg-amber-400", label: "busy" },
  out: { dot: "bg-amber-400", label: "busy" },
};

function StatusWord({ v }) {
  const m = STATUS_META[v] || { dot: "bg-zinc-500", label: v || "…" };
  return (
    <span className="font-semibold text-zinc-100">
      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function AmbientBg() {
  return (
    <div className="pointer-events-none fixed inset-0 hidden overflow-hidden lg:block" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(244,63,94,0.14),transparent_70%)]" />
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-rose-900/25 blur-[120px]" />
      <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-pink-800/20 blur-[120px]" />
      <img src="/lily.svg" alt="" className="anim-drift absolute left-[8%] top-[12%] w-24 opacity-20 blur-[1px]" draggable={false} />
      <img src="/lily.svg" alt="" className="anim-drift absolute bottom-[10%] right-[7%] w-36 opacity-15 blur-[2px]" style={{ animationDelay: "2s" }} draggable={false} />
      <img src="/lily.svg" alt="" className="anim-drift absolute bottom-[24%] left-[4%] w-14 opacity-10" style={{ animationDelay: "4s" }} draggable={false} />
    </div>
  );
}

const HOW_STEPS = [
  ["🌸", "One prompt a day", "Both answer → reveals together."],
  ["😊", "Mood + streak", "Both check in → streak grows."],
  ["💓", "Stay close", "Nudges, lamp & doodles."],
];

function DefaultGlance() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-line bg-card p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/80">why it works</div>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-400">
          <li>🌸 <b className="text-zinc-200">60 seconds a day</b>. Built for busy days and strange schedules.</li>
          <li>🔒 <b className="text-zinc-200">Locked reveals</b>. Answer honestly. No peeking.</li>
          <li>🔥 <b className="text-zinc-200">Streaks with grace</b>. Gentle. Never guilty.</li>
        </ul>
      </div>
      <div className="rounded-3xl border border-dashed border-rose-500/40 bg-card p-5 text-xs leading-relaxed text-rose-200">
        📲 This is a PWA. On your phone, use <b>Share → Add to Home Screen</b> to install it like a normal app.
      </div>
    </div>
  );
}

// Desktop shell: mobile stays a single column; on lg+ screens the app sits
// in a phone-like column with ambient backdrop + flanking panels.
function Chrome({ children, glance }) {
  return (
    <div className="relative min-h-svh bg-ink">
      <AmbientBg />
      <div className="relative mx-auto flex w-full max-w-6xl items-stretch justify-center gap-10 lg:px-6">
        <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col justify-center gap-5 self-start py-10 xl:flex">
          <div className="flex items-center gap-3">
            <img src="/lily.svg" width={40} height={40} alt="lily" draggable={false} />
            <div>
              <div className="font-display text-2xl text-rose-50">together</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">for long-distance us</div>
            </div>
          </div>
          <p className="text-sm italic leading-relaxed text-rose-200/80">“Miles apart, synced at heart.”</p>
          <div className="space-y-2.5">
            {HOW_STEPS.map(([emoji, title, text]) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-line bg-card p-3.5">
                <span className="text-2xl">{emoji}</span>
                <div>
                  <div className="text-sm font-bold text-rose-50">{title}</div>
                  <div className="text-xs text-zinc-400">{text}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-card p-4 text-xs leading-relaxed text-zinc-400">
            📲 <b className="text-zinc-200">Tip:</b> open on your phone → Share → Add to Home Screen for the full app feel + daily reminder.
          </div>
        </aside>

        <div className="min-h-svh w-full max-w-md shrink-0 bg-ink lg:border-x lg:border-line lg:shadow-[0_0_120px_-24px_rgba(244,63,94,0.45)]">
          {children}
        </div>

        <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col justify-center self-start py-10 xl:flex">
          {glance ?? <DefaultGlance />}
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState("today");
  const [now, setNow] = useState(Date.now());
  const [quote] = useState(() => bootQuote());
  const [burstKey, setBurstKey] = useState(0);
  const [toast, setToast] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");
  const [installEvt, setInstallEvt] = useState(null);
  const [pairTab, setPairTab] = useState("create");
  const [formName, setFormName] = useState("");
  const [formTz] = useState(HOME_TZ);
  const [joinCode, setJoinCode] = useState("");
  const [journalDraft, setJournalDraft] = useState("");
  const [bucketDraft, setBucketDraft] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [pushOn, setPushOn] = useState(() => {
    try {
      return localStorage.getItem("together.v1.push") === "1";
    } catch {
      return false;
    }
  });
  const [locked, setLocked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("together.v1.state"))?.lock?.enabled || false;
    } catch {
      return false;
    }
  });
  const [unlockError, setUnlockError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  const fbMode = isFirebaseConfigured;

  const burst = () => setBurstKey((k) => k + 1);
  const say = (t) => {
    setToast(t);
    window.clearTimeout(say._t);
    say._t = window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1900);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onBip = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, []);

  // Local reminder stand-in for FCM
  const reminderRef = useRef(null);
  useEffect(() => {
    if (!state.me?.reminderTime) return;
    if (reminderRef.current) reminderRef.current();
    reminderRef.current = scheduleLocalReminder(state.me.reminderTime, () => {
      say("Your daily note is ready");
      try {
        if (Notification.permission === "granted") {
          new Notification("together", { body: "Your daily note is ready" });
        }
      } catch { /* noop */ }
    });
    return () => reminderRef.current?.();
  }, [state.me?.reminderTime]);

  // Firebase realtime sync: pair doc + today's answers + partner profile.
  // Local state stays the UI cache; remote wins for shared fields.
  useEffect(() => {
    if (!fbMode || !state.me || !state.pair?.pairId) return;
    const stop = startSync({
      pairId: state.pair.pairId,
      meUid: state.me.uid,
      meProfile: {
        name: state.me.name,
        timezone: state.me.timezone,
        status: state.me.status || "free",
        reminderTime: state.me.reminderTime || "09:00",
      },
      setState,
      notify: { toast: (m) => { if (!lockedRef.current) say(m); }, burst },
      setOnline: () => {},
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbMode, state.pair?.pairId]);

  // Foreground pushes + FCM token refresh while paired.
  useEffect(() => {
    if (!fbMode || !state.me || !state.pair?.pairId) return;
    let stopped = false;
    let offFg = null;
    onForegroundMessage((payload) => {
      if (stopped || lockedRef.current) return;
      const d = payload?.data || payload?.notification || {};
      say(`${d.body || d.title || "Something new is waiting"}`);
      burst();
    })
      .then((off) => {
        offFg = off;
      })
      .catch(() => {});
    if ("Notification" in window && Notification.permission === "granted") {
      getFcmToken()
        .then((t) => fbWriteMe(state.me.uid, { fcmToken: t }).catch(() => {}))
        .catch(() => {});
    }
    return () => {
      stopped = true;
      try {
        offFg?.();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbMode, state.pair?.pairId]);

  // App theme (lilies ↔ starry night) → <html data-theme>.
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme === "stars" ? "stars" : "lilies";
  }, [state.theme]);

  const patch = (fn) => setState((s) => fn(structuredClone(s)));

  const showOnboarding = booted && (!state.seenTutorial || showHelp);
  const closeTutorial = (msg) => {
    patch((s) => {
      s.seenTutorial = true;
      return s;
    });
    setShowHelp(false);
    if (msg) {
      burst();
      say(msg);
    }
  };

  // Firebase pairing (replaces local invite codes when configured).
  const fbPairingSubmit = async () => {
    if (!formName.trim() || (pairTab === "join" && joinCode.trim().length < 4)) return;
    setPairBusy(true);
    try {
      const res =
        pairTab === "create"
          ? await fbCreatePair(formName.trim(), formTz)
          : await fbJoinPair(joinCode.trim().toUpperCase(), formName.trim(), formTz);
      const uid = loadFbLink()?.uid;
      patch((s) => {
        s.me = { uid, name: formName.trim(), timezone: formTz, status: "free", reminderTime: "09:00" };
        s.pair = { pairId: res.pairId, inviteCode: res.inviteCode, streakCount: 0, lastCheckIn: null, forgiveUsed: false };
        s.partner = null;
        s.points[uid] = 0;
        s.activity.unshift({
          id: Date.now(),
          text: pairTab === "create" ? `${formName.trim()} created invite ${res.inviteCode}` : `${formName.trim()} joined pair 💞`,
          at: Date.now(),
        });
        return s;
      });
      burst();
      say(pairTab === "create" ? "Invite created. Share your code 💌" : "Paired! 💞");
    } catch (e) {
      say(e?.message || "Pairing failed. Check your connection and try again");
    } finally {
      setPairBusy(false);
    }
  };

  // Secret surprise + developer routes (outside the app shell).
  if (typeof window !== "undefined") {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path === "/aishwarya" || window.location.hash === "#/aishwarya") {
      return <SecretPage />;
    }
    if (path === "/admin" || window.location.hash === "#/admin") {
      return <AdminPage />;
    }
  }

  if (!booted) {
    return <Splash quote={quote} />;
  }

  // ---- app lock ----
  const verifyPin = (pin) =>
    hashPin(pin, state.lock?.salt || "").then((h) => h === state.lock?.hash);

  const tryUnlock = async (pin) => {
    const ok = await verifyPin(pin);
    if (ok) {
      setLocked(false);
      setUnlockError("");
    } else {
      setAttempt((a) => a + 1);
      setUnlockError("Wrong PIN. Try again");
    }
  };

  const enableLock = async (pin) => {
    const salt = makeSalt();
    const hash = await hashPin(pin, salt);
    patch((s) => {
      s.lock = { enabled: true, hash, salt };
      return s;
    });
    say("App lock on 🔒");
  };

  const disableLock = async () => {
    patch((s) => {
      s.lock = { enabled: false, hash: "", salt: "" };
      return s;
    });
    say("App lock off");
  };

  const eraseAll = () => {
    setState(freshState());
    setLocked(false);
    setUnlockError("");
  };

  if (locked) {
    return <LockScreen attempt={attempt} error={unlockError} onPin={tryUnlock} onErase={eraseAll} />;
  }

  // ---------- Pairing gate ----------
  if (!state.me || !state.pair) {
    return (
      <Chrome>
      <div className="flex min-h-svh w-full flex-col px-6 pb-10 pt-14">
        <Petals burstKey={burstKey} />
        <div className="flex items-center gap-3">
          <Lily size={44} />
          <div>
            <h1 className="font-display title-gradient text-3xl">together</h1>
            <p className="text-xs text-zinc-400">one prompt · one mood · one streak</p>
          </div>
        </div>
        <p className="mt-6 text-sm italic text-rose-200/80">“{BOOT_QUOTES[Math.floor(now / 86400000) % BOOT_QUOTES.length]}”</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-card p-1 text-sm">
          {(["create", "join"]).map((t) => (
            <button
              key={t}
              onClick={() => setPairTab(t)}
              className={`rounded-xl px-4 py-2.5 font-semibold ${pairTab === t ? "bg-rose-600 text-white" : "text-zinc-400"}`}
            >
              {t === "create" ? "Create invite" : "Join partner"}
            </button>
          ))}
        </div>

        <div className="anim-bloom-in mt-4 rounded-3xl border border-line bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-[11px]">
            <span className="anim-pop flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-500 font-bold text-white">1</span>
            <span className="text-zinc-300">tell us your name</span>
            <span className="text-zinc-600">→</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line font-bold text-zinc-400">2</span>
            <span className="text-zinc-300">share the code</span>
          </div>
          <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">your name</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Aishwarya"
            className="mt-2 w-full rounded-xl border border-line bg-coal px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
          />
          {/* timezone locked to IST — nothing to pick 🇮🇳 */}

          {pairTab === "join" && (
            <>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-zinc-400">invite code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. KQ7M2P"
                maxLength={6}
                className="mt-2 w-full rounded-xl border border-line bg-coal px-3 py-2.5 text-sm uppercase tracking-[0.3em] outline-none placeholder:text-zinc-600 focus:border-rose-500"
              />
            </>
          )}

          <button
            disabled={!formName.trim() || (pairTab === "join" && joinCode.trim().length < 4) || pairBusy}
            onClick={async () => {
              if (fbMode) {
                await fbPairingSubmit();
                return;
              }
              if (pairTab === "create") {
                const { me, pair } = createPair(formName.trim(), formTz);
                patch((s) => {
                  s.me = me;
                  s.pair = pair;
                  s.partner = null;
                  s.points[me.uid] = 0;
                  s.activity.unshift({ id: Date.now(), text: `${me.name} created invite ${pair.inviteCode}`, at: Date.now() });
                  return s;
                });
                burst();
                say("Invite created. Share your code 💌");
              } else {
                // Demo join: accept any code, pair immediately with a waiting slot.
                const code = joinCode.trim().toUpperCase();
                patch((s) => {
                  const me = {
                    uid: `u_${Math.random().toString(36).slice(2, 8)}`,
                    name: formName.trim(),
                    timezone: formTz,
                    status: "free",
                    reminderTime: "09:00",
                  };
                  s.me = me;
                  s.pair = { pairId: `pair_${code}`, inviteCode: code, streakCount: 0, lastCheckIn: null, forgiveUsed: false };
                  s.partner = null;
                  s.points[me.uid] = 0;
                  s.activity.unshift({ id: Date.now(), text: `${me.name} joined with code ${code}`, at: Date.now() });
                  return s;
                });
                say("Joined! Add your partner's name next 💗");
              }
            }}
            className="btn-love mt-5 w-full rounded-2xl py-3 text-sm disabled:opacity-40"
          >
            {pairBusy ? "working… ⏳" : pairTab === "create" ? "Create our space 💗" : "Join with code 🔗"}
          </button>

          {!fbMode && (
          <button
            onClick={() => {
              const { me, pair } = createPair(formName.trim() || "You", formTz);
              const p = { uid: `u_demo`, name: "Sam", timezone: "America/New_York", status: "free" };
              patch((s) => {
                s.me = me;
                s.pair = pair;
                s.partner = p;
                s.points[me.uid] = 0;
                s.points[p.uid] = 0;
                s.activity.unshift({ id: Date.now(), text: `Demo pair created: ${me.name} + ${p.name}`, at: Date.now() });
                return s;
              });
              burst();
            }}
            className="mt-2 w-full rounded-2xl border border-dashed border-rose-500/40 py-2.5 text-xs font-semibold text-rose-200"
          >
            ✨ just try the demo (pairs you with Sam)
          </button>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            {isFirebaseConfigured
              ? "Synced privately between your two phones 💞"
              : "Demo mode: everything stays on this phone."}
          </p>
        </div>
        {toast && (
          <div className="anim-bloom-in fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-500/30 bg-black/90 px-4 py-2 text-xs font-semibold text-rose-100 shadow-xl">
            {toast}
          </div>
        )}
        {showOnboarding && <Onboarding onClose={() => closeTutorial("Welcome in 💗")} />}
      </div>
      </Chrome>
    );
  }

  const { me, partner, pair } = state;
  // In Firebase mode each phone answers as itself (no demo switch).
  const activeUid = !fbMode && state.viewingAs === "partner" && partner ? partner.uid : me.uid;
  const activeName = !fbMode && state.viewingAs === "partner" && partner ? partner.name : me.name;
  const dateKey = todayKey(me.timezone);
  const prompt = promptForDate(dateKey);
  const dayResponses = state.responses[dateKey] || {};
  const meR = dayResponses[me.uid];
  const partnerR = partner ? dayResponses[partner.uid] : undefined;
  const activeR = dayResponses[activeUid];
  const bothAnswered = Boolean(meR?.answer && partnerR?.answer);
  const bothCheckedIn = Boolean(meR?.mood && partnerR?.mood);

  const daysToVisit = (() => {
    if (!state.visit.date) return null;
    const diff = Math.ceil((new Date(state.visit.date + "T12:00:00") - new Date()) / 86400000);
    return diff;
  })();

  function ensureStreak(next) {
    // next = cloned state after writing a mood; apply streak + rewards
    const dk = todayKey(next.me.timezone);
    const r = next.responses[dk] || {};
    const a = r[next.me.uid]?.mood;
    const b = next.partner ? r[next.partner.uid]?.mood : null;
    if (a && b) {
      const before = next.pair.streakCount;
      next.pair = applyStreak(next.pair, dk, true, true);
      if (next.pair.lastCheckIn === dk && next.pair.streakCount !== before) {
        next.points[next.me.uid] = (next.points[next.me.uid] || 0) + 10;
        if (next.partner) next.points[next.partner.uid] = (next.points[next.partner.uid] || 0) + 10;
        next.activity.unshift({ id: Date.now(), text: `🔥 Streak day ${next.pair.streakCount}. Both checked in`, at: Date.now() });
      }
    }
    return next;
  }

  // Live "today at a glance" panel for wide desktop screens
  const glancePanel = (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-rose-500/25 bg-card p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/80">today at a glance</div>
        <div className="font-display mt-2 text-5xl text-rose-50">
          {pair.streakCount}
          <span className="text-3xl">🔥</span>
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          {bothCheckedIn ? "both checked in 🌙" : "waiting on today's check-ins"}
        </div>
        <div className="mt-3 rounded-2xl bg-black/40 p-3 text-xs italic leading-relaxed text-zinc-300">
          “{prompt}”
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-400">
          <span>{me.name}: {meR?.mood ? MOODS.find((m) => m.id === meR.mood)?.emoji : "·"}</span>
          <span>{partner?.name || "partner"}: {partnerR?.mood ? MOODS.find((m) => m.id === partnerR.mood)?.emoji : "·"}</span>
        </div>
      </div>
      {daysToVisit !== null && daysToVisit >= 0 && (
        <div className="rounded-3xl border border-line bg-card p-5 text-center">
          <div className="font-display text-4xl text-amber-200">{daysToVisit}</div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">days to next visit ✈️</div>
        </div>
      )}
      <button
        onClick={() => setShowHelp(true)}
        className="rounded-2xl border border-line bg-card p-3 text-xs font-semibold text-zinc-300 hover:border-rose-500/50"
      >
        🌸 replay the tutorial
      </button>
    </div>
  );

  const setMood = (moodId) => {
    patch((s) => {
      s.responses[dateKey] = s.responses[dateKey] || {};
      s.responses[dateKey][activeUid] = {
        answer: s.responses[dateKey][activeUid]?.answer || "",
        mood: moodId,
        submittedAt: Date.now(),
      };
      return ensureStreak(s);
    });
    if (fbMode) void fbWriteDay(pair.pairId, dateKey, activeUid, { mood: moodId }).catch(() => {});
  };

  const submitAnswer = () => {
    if (!answerDraft.trim()) return;
    if (fbMode) void fbWriteDay(pair.pairId, dateKey, activeUid, { answer: answerDraft.trim() }).catch(() => {});
    patch((s) => {
      s.responses[dateKey] = s.responses[dateKey] || {};
      const prev = s.responses[dateKey][activeUid] || {};
      s.responses[dateKey][activeUid] = { ...prev, answer: answerDraft.trim(), submittedAt: Date.now() };
      s.points[activeUid] = (s.points[activeUid] || 0) + 3;
      s.activity.unshift({ id: Date.now(), text: `${activeName} answered today's prompt`, at: Date.now() });
      return s;
    });
    setAnswerDraft("");
    burst();
    say(bothAnswered ? "Both answers revealed! 🌸" : "Locked in. Waiting on your partner 🔒");
  };

  const nudge = () => {
    patch((s) => {
      s.nudges.unshift({ from: activeUid, fromName: activeName, at: Date.now() });
      s.points[activeUid] = (s.points[activeUid] || 0) + 2;
      return s;
    });
    if (fbMode) void fbWritePair(pair.pairId, { lastNudge: { from: activeUid, fromName: activeName, at: Date.now() } }).catch(() => {});
    burst();
    say("Sent. That'll make them smile 💓");
    try {
      navigator.vibrate?.(40);
    } catch { /* noop */ }
  };

  return (
    <Chrome glance={glancePanel}>
    <div className="min-h-svh w-full bg-ink pb-28">
      <Petals burstKey={burstKey} />
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/90 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-4">
          <Lily size={30} />
          <div className="leading-tight">
            <div className="font-display title-gradient text-lg">together</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{dateKey}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fbMode ? (
              <span className="rounded-full border border-line bg-card px-3 py-1 text-[11px] font-semibold text-zinc-300">
                {me.name}
              </span>
            ) : (
              <div className="flex rounded-full border border-line bg-card p-0.5 text-[11px]">
                <button
                  onClick={() => patch((s) => { s.viewingAs = "me"; return s; })}
                  className={`rounded-full px-2.5 py-1 font-semibold ${state.viewingAs !== "partner" ? "bg-rose-600 text-white" : "text-zinc-400"}`}
                >
                  {me.name}
                </button>
                <button
                  disabled={!partner}
                  onClick={() => patch((s) => { s.viewingAs = "partner"; return s; })}
                  className={`rounded-full px-2.5 py-1 font-semibold ${state.viewingAs === "partner" ? "bg-rose-600 text-white" : "text-zinc-400 disabled:opacity-40"}`}
                >
                  {partner?.name || "…"}
                </button>
              </div>
            )}
          </div>
        </div>
        {/* streak banner */}
        <div className="px-4 pb-3 pt-2">
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-950/60 to-card px-4 py-3 shadow-[0_10px_40px_-12px_rgba(244,63,94,0.5)]">
            <span className={`text-3xl ${pair.streakCount > 0 ? "anim-flicker" : "anim-float-soft"}`}>{pair.streakCount > 0 ? "🔥" : "🌱"}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-rose-50">
                {pair.streakCount > 0 ? `${pair.streakCount}-day streak` : "Start your streak today"}
                {pair.forgiveUsed && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200">grace used 💧</span>}
              </div>
              <div className="text-[11px] text-zinc-400">
                {bothCheckedIn ? "Done for today. See you tomorrow 🌙" : "Check in together every day to grow it"}
              </div>
            </div>
            <Lily size={30} bloom={bothCheckedIn} />
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        {tab === "today" && (
          <div className="anim-bloom-in space-y-4" key={dateKey + tab}>
            {!fbMode && <p className="text-center text-xs italic text-rose-200/70">answering as <b>{activeName}</b>. Tap a name above to switch</p>}

            {/* daily prompt */}
            <section className="relative overflow-hidden rounded-3xl border border-line bg-card p-5">
              <img src="/lily.svg" alt="" aria-hidden draggable={false} className="anim-float-soft pointer-events-none absolute -right-5 -top-5 w-28 opacity-15" />
              <SectionTitle
                kicker="today's ritual"
                title="One question"
                right={<span className="text-[11px] text-zinc-500">{bothAnswered ? "🌸 revealed" : "🔒 locked"}</span>}
              />
              <p className="font-display text-lg leading-snug text-rose-50">“{prompt}”</p>

              {!bothAnswered ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className={`rounded-xl border px-3 py-2 ${meR?.answer ? "border-emerald-500/40 text-emerald-200" : "border-line text-zinc-400"}`}>
                      {me.name}: {meR?.answer ? "answered ✓" : "waiting…"}
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${partnerR?.answer ? "border-emerald-500/40 text-emerald-200" : "border-line text-zinc-400"}`}>
                      {partner?.name || "partner"}: {partnerR?.answer ? "answered ✓" : "waiting…"}
                    </div>
                  </div>
                  {!partner && (
                    <div className="mt-3 rounded-xl border border-dashed border-rose-500/40 p-3 text-xs text-rose-200">
                      No partner linked yet. Your invite code is <b className="tracking-[0.2em]">{pair.inviteCode}</b>. Add them below, or answer solo for now.
                    </div>
                  )}
                  {activeR?.answer ? (
                    <p className="mt-3 rounded-xl bg-black/40 p-3 text-center text-sm text-zinc-300">
                      Your answer is sealed 🤫. It opens up once you've both answered.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        value={answerDraft}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        rows={3}
                        placeholder={`Answer as ${activeName}…`}
                        className="w-full rounded-xl border border-line bg-coal px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
                      />
                      <button
                        onClick={submitAnswer}
                        disabled={!answerDraft.trim()}
                        className="btn-love mt-2 w-full rounded-2xl py-2.5 text-sm disabled:opacity-40"
                      >
                        Seal my answer 🔒
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 space-y-2">
                  {[me, partner].filter(Boolean).map((p) => (
                    <div key={p.uid} className="rounded-2xl border border-rose-500/20 bg-black/40 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-rose-300">{p.name}</div>
                      <div className="mt-1 text-sm leading-relaxed text-zinc-100">{dayResponses[p.uid]?.answer}</div>
                    </div>
                  ))}
                  <p className="text-center text-[11px] text-zinc-500">revealed together 🌸</p>
                </div>
              )}
            </section>

            {/* mood */}
            <section className="rounded-3xl border border-line bg-card p-5">
              <SectionTitle kicker="how are you?" title={`How is ${activeName} feeling?`} />
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`rounded-2xl border py-3 text-2xl transition active:scale-90 ${activeR?.mood === m.id ? "border-transparent bg-gradient-to-b from-rose-500 to-pink-600 shadow-lg shadow-rose-950 scale-110" : "border-line bg-coal"}`}
                    title={m.label}
                  >
                    {m.emoji}
                    <div className="mt-1 text-[9px] text-zinc-400">{m.label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                <span>{me.name}: {meR ? MOODS.find((m) => m.id === meR.mood)?.emoji : "·"}</span>
                <span>{partner?.name || "partner"}: {partnerR ? MOODS.find((m) => m.id === partnerR.mood)?.emoji : "·"}</span>
              </div>
            </section>

            {/* partner linking */}
            {!partner && !fbMode && (
              <section className="rounded-3xl border border-dashed border-rose-500/40 bg-card p-5">
                <SectionTitle kicker="pairing" title="Link your partner" />
                <PartnerForm
                  onAdd={(name) => {
                    patch((s) => {
                      const p = { uid: `u_${Math.random().toString(36).slice(2, 8)}`, name, timezone: HOME_TZ, status: "free" };
                      s.partner = p;
                      s.points[p.uid] = 0;
                      s.activity.unshift({ id: Date.now(), text: `${p.name} linked via code ${s.pair.inviteCode}`, at: Date.now() });
                      return s;
                    });
                    burst();
                    say("Paired! 💞");
                  }}
                />
                <p className="mt-2 text-center text-xs text-zinc-500">Your invite code: <b className="tracking-[0.3em] text-rose-200">{pair.inviteCode}</b></p>
              </section>
            )}
            {!partner && fbMode && (
              <section className="rounded-3xl border border-dashed border-rose-500/40 bg-card p-5 text-center">
                <div className="text-xs text-zinc-400">Share your invite code. Your partner joins on their phone</div>
                <div className="font-display mt-1 text-3xl tracking-[0.3em] text-rose-200">{pair.inviteCode}</div>
                <div className="mt-1 text-[11px] text-zinc-500">one time use only. Gone once claimed 💞</div>
              </section>
            )}

          </div>
        )}

        {tab === "connect" && (
          <div className="anim-bloom-in space-y-4" key={tab}>
            {/* thinking of you */}
            <section className="rounded-3xl border border-rose-500/25 bg-gradient-to-b from-rose-950/50 to-card p-5 text-center">
              <SectionTitle kicker="presence" title="Thinking of you" />
              <button
                onClick={nudge}
                className="thinking-glow mx-auto block h-28 w-28 rounded-full bg-gradient-to-b from-rose-500 to-rose-700 text-4xl active:scale-90"
                aria-label="Send thinking of you"
              >
                💓
              </button>
              <p className="mt-3 text-xs text-zinc-400">tap to send {partner?.name || "your partner"} a buzz 💓</p>
              {/* virtual lamp */}
              <button
                onClick={() => {
                  const next = state.lamp.litBy === activeUid ? { litBy: null, at: Date.now() } : { litBy: activeUid, at: Date.now() };
                  patch((s) => {
                    s.lamp = next;
                    return s;
                  });
                  if (fbMode) void fbWritePair(pair.pairId, { lamp: next }).catch(() => {});
                  burst();
                }}
                className={`mt-4 w-full rounded-2xl border py-3 text-sm font-semibold ${state.lamp.litBy ? "border-amber-300/50 bg-amber-300/10 text-amber-200" : "border-line bg-coal text-zinc-300"}`}
              >
                {state.lamp.litBy ? `💡 lit. Tap to dim` : "🏮 light our lamp"}
              </button>
            </section>

            {/* status */}
            <section className="rounded-3xl border border-line bg-card p-5">
              <SectionTitle kicker="presence" title="Are they free?" />
              <div className="rounded-2xl border border-line bg-coal p-4 text-center">
                <div className="text-sm text-zinc-200">
                  {me.name} is <StatusWord v={me.status} /> · {partner?.name || "partner"} is{" "}
                  <StatusWord v={partner?.status} />
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {STATUSES.map((st) => {
                    const cur = state.viewingAs === "partner" && partner ? partner.status : me.status;
                    return (
                      <button
                        key={st}
                        onClick={() => {
                          patch((s) => {
                            if (s.viewingAs === "partner" && s.partner) s.partner.status = st;
                            else s.me.status = st;
                            return s;
                          });
                          if (fbMode) void fbWriteMe(activeUid, { status: st }).catch(() => {});
                        }}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${cur === st ? "border-transparent bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-950" : "border border-line text-zinc-400"}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${STATUS_META[st].dot}`} />
                        {STATUS_META[st].label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] text-zinc-500">set yours so they know 💛</div>
              </div>
            </section>

            {/* doodle */}
            <section className="rounded-3xl border border-line bg-card p-5">
              <SectionTitle kicker="quick scribble ✍️" title={`Draw something for ${partner?.name || "your love"}`} />
              <DoodleCanvas
                onSend={(img, caption) => {
                  patch((s) => {
                    s.doodles.unshift({ id: Date.now(), by: activeUid, byName: activeName, img, caption, at: Date.now() });
                    s.points[activeUid] = (s.points[activeUid] || 0) + 5;
                    s.activity.unshift({ id: Date.now() + 1, text: `${activeName} sent a doodle 🌸`, at: Date.now() });
                    return s;
                  });
                  burst();
                  say("Doodle sent 🌸");
                }}
              />
            </section>
            <section className="rounded-3xl border border-line bg-card p-5">
              <SectionTitle kicker="keepsakes" title={`Our wall (${state.doodles.length})`} />
              {state.doodles.length === 0 && <p className="text-xs text-zinc-500">No doodles yet. Draw a crooked heart. It counts. 💗</p>}
              <div className="space-y-3">
                {state.doodles.map((d) => (
                  <div key={d.id} className="overflow-hidden rounded-2xl border border-line">
                    <img src={d.img} alt={`doodle by ${d.byName}`} className="w-full" />
                    <div className="flex items-center justify-between bg-coal px-3 py-2 text-[11px] text-zinc-400">
                      <span>{d.byName} · {d.caption || "untitled"} </span>
                      <span>{timeAgo(d.at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "us" && (
          <div className="anim-bloom-in space-y-4" key={tab}>
            {/* countdown */}
            <section className="rounded-3xl border border-rose-500/25 bg-gradient-to-b from-rose-950/50 to-card p-5 text-center">
              <SectionTitle kicker="countdown ✈️" title="Next visit" />
              {daysToVisit === null && <p className="text-xs text-zinc-400">Set the date you're together again.</p>}
              {daysToVisit !== null && daysToVisit >= 0 && (
                <div className="py-2">
                  <div className="font-display title-gradient text-6xl">{daysToVisit}</div>
                  <div className="text-xs uppercase tracking-[0.3em] text-rose-200">days to go</div>
                  {daysToVisit <= 7 && <div className="mt-2 text-sm">🎉 So close. You unlocked a milestone!</div>}
                  {daysToVisit > 7 && daysToVisit <= 30 && <div className="mt-2 text-sm">🌙 One month energy. Time to plan one date idea.</div>}
                </div>
              )}
              {daysToVisit !== null && daysToVisit < 0 && <p className="text-sm">💗 You were together recently. Add the next one!</p>}
              <p className="mt-3 text-[11px] text-zinc-500">
                🌸 every check-in brings this trip closer
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="date"
                  value={state.visit.date}
                  onChange={(e) => {
                    patch((s) => { s.visit.date = e.target.value; return s; });
                    if (fbMode) void fbWritePair(pair.pairId, { visit: { ...state.visit, date: e.target.value } }).catch(() => {});
                  }}
                  className="flex-1 rounded-xl border border-line bg-coal px-3 py-2 text-sm text-zinc-200 outline-none focus:border-rose-500"
                />
              </div>
              <input
                value={state.visit.note}
                onChange={(e) => {
                  patch((s) => { s.visit.note = e.target.value; return s; });
                  if (fbMode) void fbWritePair(pair.pairId, { visit: { ...state.visit, note: e.target.value } }).catch(() => {});
                }}
                placeholder="plan note… e.g. Aishwarya flies Friday ✈️"
                className="mt-2 w-full rounded-xl border border-line bg-coal px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
              />
            </section>

            {/* journal */}
            <section className="rounded-3xl border border-line bg-card p-5">
              <details>
                <summary className="cursor-pointer list-none">
                  <SectionTitle kicker="notes" title={`Little notes${state.journal.length ? ` (${state.journal.length})` : ""}`} right={<span className="chev text-lg text-rose-300">›</span>} />
                </summary>
              <div className="flex gap-2">
                <input
                  value={journalDraft}
                  onChange={(e) => setJournalDraft(e.target.value)}
                  placeholder={`Note as ${activeName}… “missing your laugh today”`}
                  className="flex-1 rounded-xl border border-line bg-coal px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
                />
                <button
                  onClick={() => {
                    if (!journalDraft.trim()) return;
                    patch((s) => {
                      s.journal.unshift({ id: Date.now(), by: activeUid, byName: activeName, text: journalDraft.trim(), at: Date.now() });
                      s.points[activeUid] = (s.points[activeUid] || 0) + 5;
                      return s;
                    });
                    setJournalDraft("");
                    burst();
                  }}
                  className="rounded-xl bg-rose-600 px-4 text-sm font-bold text-white active:scale-95"
                >
                  save
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {state.journal.map((j) => (
                  <li key={j.id} className="rounded-xl border border-line bg-coal p-3 text-sm">
                    <span className="text-zinc-200">{j.text}</span>
                    <span className="mt-1 block text-[10px] text-zinc-500">{j.byName} · {timeAgo(j.at)} · vibe: {j.text.length > 80 ? "reflective 🌙" : j.text.match(/love|miss|adore/i) ? "tender 💗" : "light ✨"}</span>
                  </li>
                ))}
                {state.journal.length === 0 && <li className="text-xs text-zinc-500">Empty page. Write the first line of today. ✍️</li>}
              </ul>
              </details>
            </section>

            {/* bucket */}
            <section className="rounded-3xl border border-line bg-card p-5">
              <details>
                <summary className="cursor-pointer list-none">
                  <SectionTitle kicker="dreams" title={`Someday list${state.bucket.length ? ` (${state.bucket.length})` : ""}`} right={<span className="chev text-lg text-rose-300">›</span>} />
                </summary>
              <div className="flex gap-2">
                <input
                  value={bucketDraft}
                  onChange={(e) => setBucketDraft(e.target.value)}
                  placeholder="e.g. sunrise picnic when we're together"
                  className="flex-1 rounded-xl border border-line bg-coal px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
                />
                <button
                  onClick={() => {
                    if (!bucketDraft.trim()) return;
                    patch((s) => {
                      s.bucket.unshift({ id: Date.now(), text: bucketDraft.trim(), done: false });
                      return s;
                    });
                    setBucketDraft("");
                  }}
                  className="rounded-xl bg-rose-600 px-4 text-sm font-bold text-white active:scale-95"
                >
                  add
                </button>
              </div>
              <ul className="mt-3 space-y-1.5">
                {state.bucket.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => patch((s) => {
                        const it = s.bucket.find((x) => x.id === b.id);
                        if (it) it.done = !it.done;
                        return s;
                      })}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${b.done ? "border-emerald-400 bg-emerald-400/20" : "border-line"}`}
                    >
                      {b.done ? "✓" : ""}
                    </button>
                    <span className={b.done ? "text-zinc-500 line-through" : "text-zinc-200"}>{b.text}</span>
                  </li>
                ))}
                {state.bucket.length === 0 && <li className="text-xs text-zinc-500">No dreams listed yet. Add one date idea for when you're together.</li>}
              </ul>
              </details>
            </section>

            {/* settings */}
            <section className="rounded-3xl border border-line bg-card p-5 text-sm">
              <SectionTitle kicker="settings" title="Reminders & app" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Daily reminder at</span>
                <input
                  type="time"
                  value={me.reminderTime || "09:00"}
                  onChange={(e) => {
                    patch((s) => { s.me.reminderTime = e.target.value; return s; });
                    if (fbMode) void fbWriteMe(me.uid, { reminderTime: e.target.value }).catch(() => {});
                  }}
                  className="rounded-lg border border-line bg-coal px-2 py-1 text-sm outline-none"
                />
                <button
                  onClick={async () => {
                    if (!("Notification" in window)) {
                      say("This browser can't do notifications");
                      return;
                    }
                    if (Notification.permission === "denied") {
                      say("Notifications are blocked. Allow them in site settings, then retry");
                      return;
                    }
                    const r = await requestReminderPermission();
                    if (r !== "granted") {
                      say("Tap Allow when asked, then retry");
                      return;
                    }
                    say("Reminders on 🔔");
                    if (fbMode) {
                      let token = "";
                      try {
                        token = await getFcmToken();
                      } catch (e) {
                        say(`Push setup hiccup (${e?.code || "token"}). Fully close and reopen, then retry`);
                        return;
                      }
                      try {
                        await fbWriteMe(me.uid, { fcmToken: token, reminderTime: me.reminderTime || "09:00" });
                      } catch {
                        say("Saved on this phone. Cloud save failed, retry in a bit");
                        return;
                      }
                      say("Push registered on this device 📲");
                      try {
                        localStorage.setItem("together.v1.push", "1");
                      } catch { /* noop */ }
                      setPushOn(true);
                    }
                  }}
                  className="ml-auto rounded-xl border border-line px-3 py-1.5 text-xs text-zinc-300"
                >
                  enable 🔔
                </button>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Push status:{" "}
                {pushOn ? (
                  <b className="text-emerald-300">on for this phone ✓</b>
                ) : fbMode && !hasVapid ? (
                  "not set up yet. Coming soon"
                ) : (
                  "off"
                )}
              </p>
              <div className="mt-4 rounded-2xl border border-line bg-coal p-3">
                <div className="text-xs font-bold text-zinc-200">
                  🔒 App lock {state.lock?.enabled ? "is on" : "is off"}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Hides everything behind a 4-digit PIN on this phone. Keeps casual snoopers out.
                </p>
                <LockSettings
                  enabled={state.lock?.enabled}
                  verify={verifyPin}
                  onEnable={enableLock}
                  onDisable={disableLock}
                  onLockNow={() => setLocked(true)}
                />
              </div>
              <div className="mt-4 rounded-2xl border border-line bg-coal p-3">
                <div className="text-xs font-bold text-zinc-200">✨ App theme</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { id: "lilies", label: "🌸 Lilies" },
                    { id: "stars", label: "🌟 Starry night" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => patch((s) => { s.theme = t.id; return s; })}
                      className={`rounded-xl py-2 text-xs font-bold transition active:scale-95 ${
                        (state.theme || "lilies") === t.id
                          ? "border-transparent bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-950"
                          : "border border-line text-zinc-400"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {installEvt && (
                <button
                  onClick={async () => {
                    installEvt.prompt();
                    setInstallEvt(null);
                  }}
                  className="mt-3 w-full rounded-2xl bg-rose-600 py-2.5 text-sm font-bold text-white"
                >
                  Install Together to home screen 📲
                </button>
              )}
              <details className="mt-3 rounded-xl border border-line p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-zinc-400">
                  <span>Advanced</span>
                  <span className="chev text-base text-zinc-500">›</span>
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                  <button
                    onClick={() => {
                      if (!window.confirm("Erase everything on this phone and start over?")) return;
                      const f = freshState();
                      setState(f);
                    }}
                    className="rounded-xl border border-red-500/40 py-2 text-red-300"
                  >
                    erase everything & start over
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-zinc-600">
                  {isFirebaseConfigured ? "Synced privately between your two phones 💞" : "Demo mode: everything stays on this phone."}
                </p>
                <button
                  onClick={() => setShowHelp(true)}
                  className="mt-2 w-full rounded-xl border border-line py-2 text-zinc-300"
                >
                  replay tutorial 🌸
                </button>
              </details>
            </section>
          </div>
        )}
      </main>

      {/* bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line/70 bg-ink/95 backdrop-blur lg:left-1/2 lg:right-auto lg:w-full lg:max-w-md lg:-translate-x-1/2 lg:rounded-t-[1.75rem] lg:border lg:border-b-0 lg:border-line/70 lg:shadow-[0_-12px_60px_-15px_rgba(244,63,94,0.4)]">
        <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {[
            { id: "today", icon: "🌸", label: "Today" },
            { id: "connect", icon: "💓", label: "Connect" },
            { id: "us", icon: "🌙", label: "Us" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition ${tab === t.id ? "bg-rose-500/15 text-rose-200" : "text-zinc-500"}`}
            >
              <span key={t.id + String(tab === t.id)} className={`text-xl ${tab === t.id ? "anim-pop" : ""}`}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div className="anim-bloom-in fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-500/30 bg-black/90 px-4 py-2 text-xs font-semibold text-rose-100 shadow-xl">
          {toast}
        </div>
      )}
      {showOnboarding && <Onboarding onClose={() => closeTutorial("You're all set 💗")} />}
    </div>
    </Chrome>
  );
}

function PartnerForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Partner's name"
          className="flex-1 rounded-xl border border-line bg-coal px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-500"
        />
        <button
          disabled={!name.trim()}
          onClick={() => { onAdd(name.trim()); setName(""); }}
          className="btn-love rounded-xl px-4 text-sm"
        >
          link 💞
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">They're on IST too 🇮🇳. No timezone math, ever.</p>
    </div>
  );
}
