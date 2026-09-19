// Realtime Firestore layer — active only when VITE_FIREBASE_* is set.
//
// What syncs (shared): users/{uid}, pairs/{pairId} (core, lamp, song, visit,
// lastNudge), pairs/{pairId}/days/{date} (answers + moods for the core loop).
// Local-only (this device): doodles, journal, bucket, points, activity,
// nudges history. Rationale: keeps the realtime surface tiny and avoids
// Firestore's 1 MiB doc limit for doodle images. See README for the split.
//
// Streak math stays client-side and deterministic (applyStreak), so both
// phones converge to the same count via last-write-wins.

import { ensureAnonAuth, getFirebaseAsync } from "./firebase.js";
import { applyStreak, makeInviteCode } from "./store.js";
import { todayKey } from "./content.js";

const FB_KEY = "together.v1.fb"; // { uid, pairId } — re-attaches listeners on reload

export function loadFbLink() {
  try {
    return JSON.parse(localStorage.getItem(FB_KEY));
  } catch {
    return null;
  }
}

export function saveFbLink(link) {
  try {
    localStorage.setItem(FB_KEY, JSON.stringify(link));
  } catch {
    /* ignore */
  }
}

// Last-known sync health, surfaced via the hidden 5-tap lily diagnostic.
export const fbDiag = { uid: "", pairId: "", snapAt: 0, err: "", member: "?" };

// ---------- pairing ----------

export async function fbCreatePair(name, timezone) {
  const { db, f } = await getFirebaseAsync();
  const user = await ensureAnonAuth();
  const now = Date.now();
  const code = makeInviteCode();
  const pairRef = f.doc(f.collection(db, "pairs")); // auto id
  await f.setDoc(pairRef, {
    user1: user.uid,
    user2: null,
    inviteCode: code,
    streakCount: 0,
    lastCheckIn: null,
    forgiveUsed: false,
    lamp: { litBy: null, at: null },
    lastNudge: null,
    song: { title: "", by: "", at: null },
    visit: { date: "", note: "" },
    createdAt: now,
    updatedAt: now,
  });
  await f.setDoc(f.doc(db, "invites", code), {
    pairId: pairRef.id,
    hostUid: user.uid,
    hostName: name,
    createdAt: now,
  });
  await f.setDoc(
    f.doc(db, "users", user.uid),
    { name, timezone, status: "free", reminderTime: "09:00", pairId: pairRef.id, updatedAt: now },
    { merge: true }
  );
  saveFbLink({ uid: user.uid, pairId: pairRef.id });
  return { pairId: pairRef.id, inviteCode: code };
}

export async function fbJoinPair(code, name, timezone) {
  const { db, f } = await getFirebaseAsync();
  const user = await ensureAnonAuth();
  const inv = await f.getDoc(f.doc(db, "invites", code));
  if (!inv.exists()) throw new Error("That invite didn't work. Double check the code 🔍");
  const { pairId } = inv.data();
  const pairRef = f.doc(db, "pairs", pairId);
  // Claim the empty user2 slot directly — reads are members-only, so no
  // pre-read (it would always be denied for a joiner).
  try {
    await f.updateDoc(pairRef, { user2: user.uid, updatedAt: Date.now() });
  } catch (e) {
    if (e?.code === "not-found") throw new Error("That pair is gone. Ask for a fresh code");
    throw new Error("This invite is already paired 💞");
  }
  await f.deleteDoc(f.doc(db, "invites", code)).catch(() => {});
  await f.setDoc(
    f.doc(db, "users", user.uid),
    { name, timezone, status: "free", reminderTime: "09:00", pairId, updatedAt: Date.now() },
    { merge: true }
  );
  saveFbLink({ uid: user.uid, pairId });
  return { pairId, inviteCode: code };
}

// ---------- writes (fire-and-forget from UI, optimistic local first) ----------

export async function fbWritePair(pairId, patch) {
  const { db, f } = await getFirebaseAsync();
  await f.setDoc(f.doc(db, "pairs", pairId), { ...patch, updatedAt: Date.now() }, { merge: true });
}

export async function fbWriteMe(uid, patch) {
  const { db, f } = await getFirebaseAsync();
  await f.setDoc(f.doc(db, "users", uid), { ...patch, updatedAt: Date.now() }, { merge: true });
}

export async function fbWriteDay(pairId, dateKey, uid, fields) {
  const { db, f } = await getFirebaseAsync();
  await f.setDoc(
    f.doc(db, "pairs", pairId, "days", dateKey),
    { updates: { [uid]: { ...fields, at: Date.now() } } },
    { merge: true }
  );
}

// ---------- realtime ----------
//
// startSync subscribes to the pair doc, today's day doc, and the partner's
// user doc, merging remote state into the local store. Remote wins for shared
// fields. Notifications (nudge / reveal) are derived from snapshot diffs so
// StrictMode double-renders can't double-toast.

export function startSync({ pairId, meUid, meProfile, setState, notify, setOnline }) {
  let stopped = false;
  const cleanups = [];
  const on = (fn) => {
    try {
      const u = fn();
      if (typeof u === "function") cleanups.push(u);
    } catch {
      /* ignore */
    }
  };
  const stop = () => {
    stopped = true;
    cleanups.forEach((u) => {
      try {
        u();
      } catch {
        /* ignore */
      }
    });
  };

  (async () => {
    const { db, f } = await getFirebaseAsync();
    const user = await ensureAnonAuth();
    if (stopped) return;

    // Adopt the auth identity (e.g. upgrading a demo install to Firebase).
    let uid = meUid;
    if (user.uid !== meUid) {
      uid = user.uid;
      setState((s) => {
        const n = structuredClone(s);
        n.me.uid = uid;
        return n;
      });
    }
    saveFbLink({ uid, pairId });
    fbDiag.uid = uid;
    fbDiag.pairId = pairId;
    fbDiag.err = "";
    fbDiag.member = "?";
    await f
      .setDoc(
        f.doc(db, "users", uid),
        { ...meProfile, updatedAt: Date.now() },
        { merge: true }
      )
      .catch(() => {});

    const dateKey = todayKey(meProfile?.timezone);
    let pairData = null;
    let dayData = null;
    let partnerData = null;
    let partnerUid = null;
    let partnerUnsub = null;
    let prevSig = "";
    let lastNudgeAt = 0;
    let prevBoth = false;
    let missingToastShown = false;
    let deniedToastShown = false;

    const otherUid = () => {
      if (!pairData) return null;
      return pairData.user1 === uid ? pairData.user2 : pairData.user1;
    };

    const merge = () => {
      if (stopped || !pairData) return;
      const ou = otherUid();
      if (ou !== partnerUid) {
        try {
          partnerUnsub?.();
        } catch {
          /* ignore */
        }
        partnerUid = ou;
        partnerData = null;
        if (ou) {
          on(() =>
            f.onSnapshot(
              f.doc(db, "users", ou),
              (s2) => {
                if (stopped) return;
                partnerData = s2.exists() ? s2.data() : null;
                merge();
              },
              () => {}
            )
          );
        }
      }

      const remote = { p: pairData, d: dayData, u: partnerData };
      const sig = JSON.stringify(remote);
      if (sig === prevSig) return;
      const first = prevSig === "";
      prevSig = sig;

      const ups = dayData?.updates || {};
      const members = [pairData.user1, pairData.user2].filter(Boolean);
      const bothNow = members.length === 2 && members.every((m) => ups[m]?.answer);

      if (!first) {
        const ln = pairData.lastNudge;
        if (ln && ln.at > lastNudgeAt && ln.from !== uid) {
          notify.toast(`💓 ${ln.fromName || "Your person"} is thinking of you`);
          notify.burst();
        }
        if (bothNow && !prevBoth) {
          notify.toast("Both answers revealed! 🌸");
          notify.burst();
        }
      }
      if (pairData.lastNudge) lastNudgeAt = Math.max(lastNudgeAt, pairData.lastNudge.at || 0);
      prevBoth = bothNow;

      // Converge streak deterministically (idempotent — both phones agree).
      const m1 = ups[pairData.user1]?.mood;
      const m2 = pairData.user2 ? ups[pairData.user2]?.mood : null;
      if (m1 && m2) {
        const test = applyStreak(
          {
            streakCount: pairData.streakCount || 0,
            lastCheckIn: pairData.lastCheckIn || null,
            forgiveUsed: !!pairData.forgiveUsed,
          },
          dateKey,
          true,
          true
        );
        if (test.lastCheckIn === dateKey && test.streakCount !== (pairData.streakCount || 0)) {
          fbWritePair(pairId, {
            streakCount: test.streakCount,
            lastCheckIn: test.lastCheckIn,
            forgiveUsed: test.forgiveUsed,
          }).catch(() => {});
        }
      }

      setState((s) => {
        const n = structuredClone(s);
        n.pair = {
          ...n.pair,
          streakCount: pairData.streakCount ?? n.pair.streakCount,
          lastCheckIn: pairData.lastCheckIn ?? n.pair.lastCheckIn,
          forgiveUsed: !!pairData.forgiveUsed,
          inviteCode: pairData.inviteCode || n.pair.inviteCode,
        };
        if (pairData.lamp) n.lamp = pairData.lamp;
        if (pairData.song) n.song = pairData.song;
        if (pairData.visit) n.visit = pairData.visit;
        if (ou) {
          n.partner = {
            uid: ou,
            name: partnerData?.name || n.partner?.name || "partner",
            timezone: partnerData?.timezone || n.partner?.timezone || "UTC",
            status: partnerData?.status || n.partner?.status || "free",
          };
        }
        if (dayData?.updates) {
          n.responses[dateKey] = { ...(n.responses[dateKey] || {}) };
          for (const [id, u] of Object.entries(dayData.updates)) {
            n.responses[dateKey][id] = {
              answer: u.answer || "",
              mood: u.mood || n.responses[dateKey][id]?.mood,
              submittedAt: u.at || Date.now(),
            };
          }
          // Recompute streak from merged check-ins (same deterministic math).
          const r = n.responses[dateKey];
          const a = r[pairData.user1]?.mood;
          const b = pairData.user2 ? r[pairData.user2]?.mood : null;
          if (a && b) {
            const before = n.pair.streakCount;
            n.pair = applyStreak(n.pair, dateKey, true, true);
            if (n.pair.lastCheckIn === dateKey && n.pair.streakCount !== before) {
              n.points[n.me.uid] = (n.points[n.me.uid] || 0) + 10;
              if (ou) n.points[ou] = (n.points[ou] || 0) + 10;
              n.activity.unshift({
                id: Date.now(),
                text: `🔥 Streak day ${n.pair.streakCount}. Both checked in`,
                at: Date.now(),
              });
            }
          }
        }
        return n;
      });
    };

    on(() =>
      f.onSnapshot(
        f.doc(db, "pairs", pairId),
        (snap) => {
          if (stopped) return;
          if (!snap.exists()) {
            // Stale demo pair (created before Firebase) or deleted pair:
            // tell the user to reset and re-pair instead of hanging offline.
            setOnline(false);
            if (!missingToastShown) {
              missingToastShown = true;
              notify.toast("Pair not found in the cloud. Reset and pair again 💞");
            }
            return;
          }
          pairData = snap.data();
          fbDiag.snapAt = Date.now();
          fbDiag.err = "";
          fbDiag.member = pairData.user1 === uid || pairData.user2 === uid ? "yes" : "no";
          setOnline(true);
          merge();
        },
        (e) => {
          fbDiag.err = e?.code || "listen-failed";
          setOnline(false);
          // This phone's identity isn't a pair member (e.g. auth was reset):
          // reads can never succeed — say so plainly, once.
          if (!deniedToastShown && fbDiag.err === "permission-denied") {
            deniedToastShown = true;
            notify.toast("This phone lost access to the pair. Get a fresh code and re-join 💞");
          }
        }
      )
    );
    on(() =>
      f.onSnapshot(
        f.doc(db, "pairs", pairId, "days", dateKey),
        (snap) => {
          if (stopped) return;
          dayData = snap.exists() ? snap.data() : null;
          merge();
        },
        (e) => {
          if (!fbDiag.err) fbDiag.err = e?.code || "day-listen-failed";
        }
      )
    );
    cleanups.push(() => {
      try {
        partnerUnsub?.();
      } catch {
        /* ignore */
      }
    });
  })().catch(() => {
    if (!stopped) {
      setOnline(false);
      notify.toast("Couldn't reach Firebase. Working offline for now");
    }
  });

  return stop;
}
