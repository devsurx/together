// Together — scheduled daily prompt reminder.
//
// Runs every 15 minutes. For each user with an FCM token whose LOCAL time
// matches their reminderTime (default 09:00), sends today's prompt question.
// Data-only payload; the app (foreground) and firebase-messaging-sw.js
// (background) render it. Marks users/{uid}.lastReminded so we send once/day.
//
// Deploy: firebase deploy --only functions   (requires Blaze plan)

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

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

exports.dailyReminder = onSchedule({ schedule: "every 15 minutes", timeZone: "Utc" }, async () => {
  const db = admin.firestore();
  const messaging = admin.messaging();
  const now = Date.now();
  const snap = await db.collection("users").limit(500).get();
  const jobs = [];

  for (const doc of snap.docs) {
    const u = doc.data();
    if (!u.fcmToken || !u.reminderTime) continue;
    const parts = localParts(now, u.timezone);
    if (!parts || parts.hm !== u.reminderTime || u.lastReminded === parts.date) continue;

    // Discreet by design: vague wording, safe on any lock screen.
    const body = "Your daily note is ready";
    jobs.push(
      messaging
        .send({
          token: u.fcmToken,
          notification: { title: "together", body },
          webpush: {
            headers: { Urgency: "normal" },
            notification: { icon: "/icon.svg", badge: "/lily.svg" },
            fcm_options: { link: "/" },
          },
          data: { title: "together", body, link: "/" },
        })
        .then(() => doc.ref.update({ lastReminded: parts.date }).catch(() => {}))
        .catch((e) => {
          // Stale token? Clear it so we stop retrying daily.
          if (e.code === "messaging/registration-token-not-registered") {
            return doc.ref.update({ fcmToken: "" }).catch(() => {});
          }
        })
    );
  }

  await Promise.allSettled(jobs);
});
