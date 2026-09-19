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

// (Prompt text lives in the app; pushes stay discreet by design.)

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
console.log("target project:", projectId);
const client = await auth.getClient();
const H = { ...(await client.getRequestHeaders()), "Content-Type": "application/json" };
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

  // Discreet by design: vague, no names, no hearts — safe on any lock screen.
  const body = "Your daily note is ready";
  const send = await fetch(FCM_URL, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      message: {
        token: fcm,
        notification: { title: "together", body },
        webpush: {
          headers: { Urgency: "normal" },
          notification: { icon: "/icon.svg", badge: "/lily.svg" },
          fcm_options: { link: "/" },
        },
        data: { title: "together", body, link: "/" },
      },
    }),
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

  const riskBody = "A quick check-in is waiting";
  const send2 = await fetch(FCM_URL, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      message: {
        token: fcm,
        notification: { title: "together", body: riskBody },
        webpush: {
          notification: { icon: "/icon.svg", badge: "/lily.svg" },
          fcm_options: { link: "/" },
        },
        data: { title: "together", body: riskBody, link: "/" },
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
