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
  apiKey: "AIzaSyDHbvYkVA1XDaFfJZgfPK6NmCvyCO0XMXU",
  authDomain: "together-couples-3f56f.firebaseapp.com",
  projectId: "together-couples-3f56f",
  appId: "1:284290462881:web:fa8fe20b430d0825b1ece0",
});

const messaging = firebase.messaging();

// Pushes carry a visible `notification` payload (required for iOS background
// delivery), which the system displays itself. Only data-only payloads are
// rendered manually here — otherwise you'd get every ping twice.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const d = payload.data || {};
  self.registration.showNotification(d.title || "together", {
    body: d.body || "You have something new waiting.",
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
