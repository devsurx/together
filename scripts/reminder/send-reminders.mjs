// Together — $0 daily prompt reminder (no Blaze/billing required).
//
// Runs as a GitHub Actions cron (see .github/workflows/daily-reminder.yml).
// Reads users via Firestore REST, sends due reminders via FCM HTTP v1,
// marks users/{uid}.lastReminded so each device gets one push per day.
//
// Env: FIREBASE_SERVICE_ACCOUNT = full service-account JSON (repo secret).
// The service account needs the "Firebase Admin" role (or equivalent
// Firestore read/write + FCM send permissions).

import { GoogleAuth } from "google-auth-library";

// Compact pool (mirrors functions/index.js + src/lib/content.js).
const PROMPTS = [
  "What is one small thing I did lately that made you feel loved?",
  "What are you most looking forward to doing together next visit?",
  "What is something you've been missing about us this week?",
  "Describe your perfect slow Sunday together, hour by hour.",
  "What made you laugh today?",
  "What is one win from today, however small?",
  "What song reminds you of us right now, and why?",
  "What do you need more of from me this week?",
  "What time of day do you miss me most?",
  "What would you cook for me if we were in the same kitchen tonight?",
  "What is stressing you out that I can carry a little of?",
  "What is a tiny habit we should start together, even apart?",
];

function promptForDate(dateKey) {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return PROMPTS[h % PROMPTS.length];
}

function localParts(now, tz) {
  try {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(now));
    return { date, hm };
  } catch {
    return null;
  }
}

const str = (fields, k) => fields?.[k]?.stringValue ?? "";

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!sa.project_id) {
  console.error("missing FIREBASE_SERVICE_ACCOUNT secret");
  process.exit(1);
}
const projectId = sa.project_id;

const auth = new GoogleAuth({
  credentials: sa,
  scopes: [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/firebase.messaging",
  ],
});
const { token } = await auth.getAccessToken();
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const now = Date.now();

const q = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
  {
    method: "POST",
    headers: H,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "users" }], limit: 500 } }),
  }
);
if (!q.ok) {
  console.error("firestore query failed:", q.status, await q.text());
  process.exit(1);
}

const DB = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

const usersSeen = [];
for (const row of await q.json()) {
  const doc = row.document;
  if (!doc) continue;
  const uid = doc.name.split("/").pop();
  const f = doc.fields || {};
  usersSeen.push({ uid, name: doc.name, f });
  const fcm = str(f, "fcmToken");
  const rt = str(f, "reminderTime");
  const tz = str(f, "timezone") || "UTC";
  const last = str(f, "lastReminded");
  if (!fcm || !rt) continue;
  const parts = localParts(now, tz);
  if (!parts || parts.hm !== rt || last === parts.date) continue;

  const body = `Today's prompt: ${promptForDate(parts.date)}`;
  const send = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ message: { token: fcm, data: { title: "Together 💗", body, link: "/" } } }),
  });

  if (send.ok) {
    await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=lastReminded`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { lastReminded: { stringValue: parts.date } } }),
    });
    console.log(`reminded ${uid} (${parts.date} ${parts.hm} ${tz})`);
  } else {
    const t = await send.text();
    console.error(`send failed for ${uid}: ${send.status} ${t}`);
    if (send.status === 404 && /UNREGISTERED|NOT_FOUND/.test(t)) {
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=fcmToken`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify({ fields: { fcmToken: { stringValue: "" } } }),
      });
    }
  }
}

// ---- streak-at-risk: after 21:00 local, partner checked in but you haven't ----
const pairCache = new Map();
async function pairFor(uid) {
  if (pairCache.has(uid)) return pairCache.get(uid);
  let found = null;
  for (const field of ["user1", "user2"]) {
    const r = await fetch(`${DB}/documents:runQuery`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "pairs" }],
          where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: uid } } },
          limit: 1,
        },
      }),
    });
    if (!r.ok) break;
    const rows = await r.json();
    if (rows[0]?.document) {
      found = { id: rows[0].document.name.split("/").pop(), fields: rows[0].document.fields || {} };
      break;
    }
  }
  pairCache.set(uid, found);
  return found;
}

for (const u of usersSeen) {
  const fcm = str(u.f, "fcmToken");
  if (!fcm) continue;
  const tz = str(u.f, "timezone") || "UTC";
  const parts = localParts(now, tz);
  if (!parts || Number(parts.hm.slice(0, 2)) < 21) continue; // evenings only
  if (str(u.f, "lastRiskNudge") === parts.date) continue;

  // resolve pair (fast path: pairId on the user doc)
  let pairId = str(u.f, "pairId");
  let pf = null;
  if (pairId) {
    const pr = await fetch(`${DB}/documents/pairs/${pairId}`, { headers: H });
    if (pr.ok) pf = (await pr.json()).fields || {};
    else pairId = null;
  }
  if (!pairId) {
    const found = await pairFor(u.uid);
    if (!found) continue;
    pairId = found.id;
    pf = found.fields;
  }
  const user1 = str(pf, "user1");
  const user2 = str(pf, "user2");
  if (!user2) continue; // not paired yet
  const other = user1 === u.uid ? user2 : user1;

  const dr = await fetch(`${DB}/documents/pairs/${pairId}/days/${parts.date}`, { headers: H });
  let ups = {};
  if (dr.ok) ups = (await dr.json()).fields?.updates?.mapValue?.fields || {};
  const moodOf = (id) => ups[id]?.mapValue?.fields?.mood?.stringValue;
  if (moodOf(u.uid) || !moodOf(other)) continue; // done, or nothing to save

  let partnerName = "Your person";
  const on = await fetch(`${DB}/documents/users/${other}`, { headers: H });
  if (on.ok) partnerName = str((await on.json()).fields || {}, "name") || partnerName;

  const send2 = await fetch(FCM_URL, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      message: {
        token: fcm,
        data: {
          title: "Together 🔥",
          body: `${partnerName} already checked in — 30 seconds to save the streak`,
          link: "/",
        },
      },
    }),
  });
  if (send2.ok) {
    await fetch(`https://firestore.googleapis.com/v1/${u.name}?updateMask.fieldPaths=lastRiskNudge`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { lastRiskNudge: { stringValue: parts.date } } }),
    });
    console.log(`risk nudge ${u.uid} (${parts.date})`);
  } else {
    console.error(`risk send failed for ${u.uid}: ${send2.status} ${await send2.text()}`);
  }
}

console.log("done");
