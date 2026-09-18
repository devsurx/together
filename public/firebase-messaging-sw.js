// Firebase Cloud Messaging service worker — handles pushes while the app
// is closed. FCM requires this exact filename at the site root.
//
// ▼▼▼ SETUP: paste the SAME 4 values from your .env below ▼▼▼
// (Firebase web keys are public by design — safe to commit.)
//   VITE_FIREBASE_API_KEY      → apiKey
//   VITE_FIREBASE_AUTH_DOMAIN  → authDomain
//   VITE_FIREBASE_PROJECT_ID   → projectId
//   VITE_FIREBASE_APP_ID       → appId

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "PASTE_VITE_FIREBASE_API_KEY",
  authDomain: "PASTE_VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "PASTE_VITE_FIREBASE_PROJECT_ID",
  appId: "PASTE_VITE_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// The Cloud Function sends data-only payloads; we render them here so the
// notification always shows (and never double-shows).
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Together 💗", {
    body: d.body || "Today's prompt is waiting for both of you.",
    icon: "/icon.svg",
    badge: "/lily.svg",
    data: { url: d.link || "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.focus();
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
