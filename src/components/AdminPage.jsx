import { useState } from "react";
import { ensureAnonAuth, getFirebaseAsync } from "../lib/firebase.js";

// Developer dashboard at /admin — pairs, names, statuses, streaks.
// Login gate: VITE_ADMIN_USER / VITE_ADMIN_PASS (baked at build time).
//
// Honest scope: this is a convenience gate, not bank security. Anyone who
// opens the app is already an authenticated Firestore user, and listing
// pairs/users is allowed for authed users so this page can work. Answers +
// moods (days/*) stay members-only and are NEVER shown here. Harden with
// Firebase custom claims before any real scale or sensitive use.
const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "";

function fmtTs(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem("together.admin") === "1";
    } catch {
      return false;
    }
  });
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      await ensureAnonAuth();
      const { db, f } = await getFirebaseAsync();
      const [pairsSnap, usersSnap, invitesSnap] = await Promise.all([
        f.getDocs(f.query(f.collection(db, "pairs"), f.limit(200))),
        f.getDocs(f.query(f.collection(db, "users"), f.limit(200))),
        f.getDocs(f.query(f.collection(db, "invites"), f.limit(200))),
      ]);
      setData({
        at: Date.now(),
        pairs: pairsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        invites: invitesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    } catch (e) {
      setErr(`Couldn't load data (${e?.code || "check rules + connection"})`);
    }
    setLoading(false);
  };

  const login = async () => {
    if (!ADMIN_USER || !ADMIN_PASS) {
      setErr("Admin login isn't configured on this build.");
      return;
    }
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      try {
        sessionStorage.setItem("together.admin", "1");
      } catch {
        /* ignore */
      }
      setAuthed(true);
      setErr("");
      await load();
    } else {
      setErr("Nope. Try again.");
    }
  };

  const logout = () => {
    try {
      sessionStorage.removeItem("together.admin");
    } catch {
      /* ignore */
    }
    setAuthed(false);
    setData(null);
    setU("");
    setP("");
  };

  if (!authed) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-ink px-8">
        <div className="w-full max-w-xs rounded-3xl border border-line bg-card p-6">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">together · admin</div>
          <h1 className="font-display mt-2 text-2xl text-zinc-100">Who goes there?</h1>
          <input
            value={u}
            onChange={(e) => setU(e.target.value)}
            placeholder="username"
            autoComplete="username"
            className="mt-4 w-full rounded-xl border border-line bg-coal px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-400"
          />
          <input
            value={p}
            onChange={(e) => setP(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
            placeholder="password"
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-line bg-coal px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-400"
          />
          {err ? <p className="mt-2 text-xs font-semibold text-red-300">{err}</p> : null}
          <button
            onClick={login}
            className="mt-3 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-zinc-900 active:scale-[0.98]"
          >
            enter
          </button>
        </div>
      </div>
    );
  }

  const usersById = Object.fromEntries((data?.users || []).map((x) => [x.id, x]));
  const pairs = data?.pairs || [];
  const paired = pairs.filter((x) => x.user2).length;
  const waiting = pairs.length - paired;

  return (
    <div className="mx-auto min-h-svh w-full max-w-3xl bg-ink px-4 py-8 font-mono">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">together · admin</div>
          <h1 className="font-display text-2xl text-zinc-100">Everyone, at a glance</h1>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={load} disabled={loading} className="rounded-lg border border-line px-3 py-1.5 text-zinc-300 disabled:opacity-40">
            {loading ? "loading…" : "refresh ⟳"}
          </button>
          <button onClick={logout} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-red-300">
            log out
          </button>
        </div>
      </div>

      {err ? <p className="mt-3 text-xs font-semibold text-red-300">{err}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["pairs", pairs.length],
          ["paired", paired],
          ["waiting", waiting],
          ["users", (data?.users || []).length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-card p-4 text-center">
            <div className="text-3xl font-bold text-zinc-100">{v}</div>
            <div className="text-[11px] uppercase tracking-widest text-zinc-500">{k}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-widest text-zinc-400">
        Pairs ({pairs.length})
      </h2>
      <div className="mt-2 space-y-2">
        {pairs.map((x) => {
          const a = usersById[x.user1];
          const b = x.user2 ? usersById[x.user2] : null;
          return (
            <div key={x.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
              <div className="text-base font-bold text-zinc-100">
                {a?.name || "…"} <span className="text-zinc-500">💞</span> {x.user2 ? b?.name || "…" : "waiting…"}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-400">
                <span>streak: <b className="text-zinc-200">{x.streakCount || 0}🔥</b></span>
                <span>last check-in: <b className="text-zinc-200">{x.lastCheckIn || "—"}</b></span>
                <span>
                  status: <b className="text-zinc-200">{a?.status || "—"}</b> · <b className="text-zinc-200">{x.user2 ? b?.status || "—" : "—"}</b>
                </span>
                <span>visit: <b className="text-zinc-200">{x.visit?.date || "—"}</b></span>
                <span className="truncate">code: <b className="text-zinc-200">{x.inviteCode || "—"}</b></span>
                <span>push: <b className="text-zinc-200">{a?.fcmToken ? "✓" : "·"}/{x.user2 ? (b?.fcmToken ? "✓" : "·") : "·"}</b></span>
              </div>
            </div>
          );
        })}
        {pairs.length === 0 && <p className="text-xs text-zinc-500">No pairs yet.</p>}
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-widest text-zinc-400">
        Users ({(data?.users || []).length})
      </h2>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-zinc-500">
              <th className="px-3 py-2 font-semibold">name</th>
              <th className="px-3 py-2 font-semibold">timezone</th>
              <th className="px-3 py-2 font-semibold">status</th>
              <th className="px-3 py-2 font-semibold">push</th>
              <th className="px-3 py-2 font-semibold">updated</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users || []).map((x) => (
              <tr key={x.id} className="border-b border-line/50 last:border-0">
                <td className="px-3 py-2 font-bold text-zinc-100">{x.name || "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{x.timezone || "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{x.status || "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{x.fcmToken ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-zinc-500">{fmtTs(x.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.invites || []).length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-widest text-zinc-400">
            Open invites ({data.invites.length})
          </h2>
          <div className="mt-2 space-y-1.5 text-xs text-zinc-400">
            {data.invites.map((x) => (
              <div key={x.id} className="rounded-xl border border-line bg-card px-3 py-2">
                <b className="tracking-[0.2em] text-zinc-200">{x.id}</b> · by {usersById[x.hostUid]?.name || x.hostName || "…"} · {fmtTs(x.createdAt)}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-[11px] text-zinc-600">
        Answers + moods stay private to each pair and never appear here. Snapshot taken{" "}
        {data ? new Date(data.at).toLocaleTimeString("en-IN") : "—"}.
      </p>
    </div>
  );
}
