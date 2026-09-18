// Local-first store that mirrors the Firestore data model from the blueprint:
//   users/{uid}: { name, partnerId, timezone, fcmToken }
//   pairs/{pairId}: { user1, user2, streakCount, lastCheckIn, ... }
//   dailyPrompts/{date}: { question }
//   responses/{pairId}/{date}/{uid}: { answer, mood, submittedAt }
//
// In demo mode everything lives in localStorage under one key so the app
// works with zero backend config. Swap `loadState/saveState` for Firestore
// reads/writes (see src/lib/firebase.js) to go multi-device.

const KEY = "together.v1.state";

function uid(prefix = "u") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function freshState() {
  return {
    me: null, // { uid, name, timezone, status, fcmToken, reminderTime }
    partner: null, // { uid, name, timezone, status }
    pair: null, // { pairId, inviteCode, streakCount, lastCheckIn, forgiveUsed }
    responses: {}, // { [dateKey]: { [uid]: { answer, mood, submittedAt } } }
    nudges: [], // [{ from, fromName, at }]
    lamp: { litBy: null, at: null },
    doodles: [], // [{ id, by, byName, img, caption, at }]
    journal: [], // [{ id, by, byName, text, at }]
    bucket: [], // [{ id, text, done }]
    visit: { date: "", note: "" },
    song: { title: "", by: "", at: null },
    points: {}, // { [uid]: number }
    seenTutorial: false,
    lock: { enabled: false, hash: "", salt: "" },
    viewingAs: "me", // 'me' | 'partner' — demo switch to simulate both phones
    activity: [], // recent event feed strings {id, text, at}
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    return { ...freshState(), ...parsed };
  } catch {
    return freshState();
  }
}

export function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full — ignore in demo */
  }
}

export function makeInviteCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function createPair(name, timezone) {
  const me = { uid: uid("u"), name, timezone, status: "free", reminderTime: "09:00" };
  const pairId = uid("pair");
  const pair = { pairId, inviteCode: makeInviteCode(), streakCount: 0, lastCheckIn: null, forgiveUsed: false };
  return { me, pair };
}

export function joinPair(name, timezone, code, existingPair) {
  const me = { uid: uid("u"), name, timezone, status: "free", reminderTime: "09:00" };
  return { me, pair: existingPair, partner: null };
}

export function dayDiff(aKey, bKey) {
  // 'YYYY-MM-DD' diff in days
  const a = new Date(aKey + "T12:00:00Z");
  const b = new Date(bKey + "T12:00:00Z");
  return Math.round((b - a) / 86400000);
}

// Streak: increments when both partners check in on the same day.
// Soft-forgive: one missed day keeps the streak if forgive not yet used that gap.
export function applyStreak(pair, dateKey, meDone, partnerDone) {
  if (!meDone || !partnerDone) return pair;
  if (pair.lastCheckIn === dateKey) return pair;
  const next = { ...pair };
  if (!pair.lastCheckIn) {
    next.streakCount = 1;
  } else {
    const gap = dayDiff(pair.lastCheckIn, dateKey);
    if (gap === 1) next.streakCount = pair.streakCount + 1;
    else if (gap === 2 && !pair.forgiveUsed) {
      next.streakCount = pair.streakCount + 1;
      next.forgiveUsed = true;
    } else if (gap <= 0) {
      return pair;
    } else {
      next.streakCount = 1;
      next.forgiveUsed = false;
    }
  }
  next.lastCheckIn = dateKey;
  return next;
}
