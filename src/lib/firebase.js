// Firebase wiring stub. Fill these env vars (see .env.example) to go live:
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
//   VITE_FIREBASE_APP_ID, VITE_FIREBASE_VAPID_KEY
//
// Until then the app runs 100% in local demo mode via src/lib/store.js.
// When configured, replace loadState/saveState with Firestore doc sync:
//
//   users/{uid}, pairs/{pairId}, responses/{pairId}/{date}/{uid}
// Realtime: onSnapshot(pairDoc) + onSnapshot(responsesForToday).
// Push: Firebase Cloud Messaging with the VAPID key for the daily reminder.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

export async function requestReminderPermission() {
  if (!("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function scheduleLocalReminder(timeHHMM, onFire) {
  // Minimal local stand-in for FCM: checks every 30s whether it's reminder time.
  const id = setInterval(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm === timeHHMM) onFire?.();
  }, 30000);
  return () => clearInterval(id);
}
