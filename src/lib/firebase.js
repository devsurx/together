// Firebase client: init, anonymous auth, Firestore handle, FCM helpers.
// Active only when VITE_FIREBASE_* env vars are present (see .env.example).
// Without them the app runs fully offline in local demo mode.
//
// Fully lazy: firebase SDK modules load ONLY when configured AND needed, so
// the demo bundle stays lean. Everything async for that reason.
//
// Background pushes are handled by public/firebase-messaging-sw.js
// (same project config, pasted there — FCM requires that exact filename).

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

// VAPID key is what makes push registration possible (separate from sync).
export const hasVapid = Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY || "");

let cached = null;

export async function getFirebaseAsync() {
  if (!isFirebaseConfigured) return null;
  if (!cached) {
    cached = (async () => {
      const [{ initializeApp, getApps }, { getAuth }, f] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      return { app, auth: getAuth(app), db: f.getFirestore(app), f };
    })();
  }
  return cached;
}

// One anonymous identity per browser (persisted by the SDK). Each partner's
// phone gets its own uid; pairing links the two uids in pairs/{pairId}.
export async function ensureAnonAuth() {
  const fb = await getFirebaseAsync();
  if (!fb) throw new Error("firebase-not-configured");
  if (fb.auth.currentUser) return fb.auth.currentUser;
  const [{ signInAnonymously, onAuthStateChanged }] = await Promise.all([import("firebase/auth")]);
  const cred = await signInAnonymously(fb.auth);
  if (cred.user) return cred.user;
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(
      fb.auth,
      (u) => {
        off();
        if (u) resolve(u);
        else reject(new Error("auth-failed"));
      },
      (e) => {
        off();
        reject(e);
      }
    );
  });
}

// FCM registration token for THIS device. Call after Notification permission
// is granted (see Settings → enable 🔔). Stored on users/{uid}.fcmToken so
// the scheduled Cloud Function knows where to send the daily prompt.
export async function getFcmToken() {
  const fb = await getFirebaseAsync();
  if (!fb) throw new Error("firebase-not-configured");
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
  if (!vapidKey) throw new Error("missing VITE_FIREBASE_VAPID_KEY");
  const { getMessaging, getToken } = await import("firebase/messaging");
  return getToken(getMessaging(fb.app), { vapidKey });
}

// Foreground pushes while the app is open → toast + petals (wired in App).
export async function onForegroundMessage(cb) {
  const fb = await getFirebaseAsync();
  if (!fb) throw new Error("firebase-not-configured");
  const { getMessaging, onMessage } = await import("firebase/messaging");
  return onMessage(getMessaging(fb.app), cb);
}

export async function requestReminderPermission() {
  if (!("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function scheduleLocalReminder(timeHHMM, onFire) {
  // Local stand-in used in demo mode (no FCM). In Firebase mode the Cloud
  // Function sends the real push; this stays as a fallback while open.
  const id = setInterval(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm === timeHHMM) onFire?.();
  }, 30000);
  return () => clearInterval(id);
}
