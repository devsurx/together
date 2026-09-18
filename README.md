# Together 🌸

A lightweight, mobile-first **Progressive Web App (PWA)** for long-distance couples. One shared daily prompt, one mood check-in, one visible streak — a 60-second ritual designed so both partners actually open it every day.

> "Miles apart, synced at heart."

**Live:** https://together-couples-3f56f.web.app — open on both phones, one creates an invite code, the other joins.

## ✨ Features

Three simple tabs. Nothing else.

**🌸 Today — the daily ritual**
- 📝 **One question** — a shared prompt every morning; answers stay locked until *both* respond, then reveal together
- 😊 **Mood check-in** — one emoji tap each; both checking in grows the **🔥 streak** (one miss forgiven)
- Invite-code pairing with a live `● live sync` / `○ offline` indicator in the header

**💓 Connect — feel close instantly**
- Big **thinking-of-you button** (pulse + petals + gentle buzz on their phone)
- 🏮 **Shared lamp** — light it, they see it glowing
- 🟢 **Status** — free / busy / sleeping, so nobody has to ask "are you busy?"
- ✍️ **Quick scribbles** — finger-drawn doodles on a shared wall

**🌙 Us — looking forward**
- ✈️ **Visit countdown** with milestones
- 📝 Little notes journal + someday list (tucked into accordions)
- 🔔 Daily reminder time + notification setup, install prompt, first-run tutorial

**Design** — romantic, moody, a little magical: black canvas, rose/pink gradient accents, lily motif with bloom/fade/petal/ripple animations, staggered card entrances. Two themes: 🌸 Lilies and 🌟 Starry night (golden, switch in Settings). IST-locked (Asia/Kolkata) — no timezone pickers, no clock math.

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| PWA | `vite-plugin-pwa` (manifest + Workbox service worker) |
| Auth | Firebase Anonymous (one ID per phone, no login screen) |
| Sync | Cloud Firestore realtime (`onSnapshot`) |
| Push | Firebase Cloud Messaging + `firebase-messaging-sw.js` |
| Daily reminder | GitHub Actions cron every 15 min (**$0, no Blaze/billing**) — `functions/` holds an equivalent Cloud Function as an optional path |
| Without keys | App runs fully offline in local demo mode (header `You / Partner` toggle simulates both phones) |

### Firestore layout

```
users/{uid}                 { name, timezone, status, reminderTime, fcmToken, lastReminded }
pairs/{pairId}              { user1, user2, inviteCode, streakCount, lastCheckIn, forgiveUsed,
                              lamp, lastNudge, song, visit }
pairs/{pairId}/days/{date}  { updates: { {uid}: { answer, mood, at } } }
invites/{CODE}              single-use join ticket { pairId, hostUid, ... } (deleted on claim)
```

Local-only (this device): doodles, journal, bucket list, points, activity feed.

## 🚀 Getting started

Requirements: Node.js 18+.

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # production build + service worker
npm run preview  # preview the production build
```

## 📲 Install as an app

On your phone open the hosted URL → **Share → Add to Home Screen**. Reminder time + notification permission live in **Us → Settings → enable 🔔** (tap once per phone to register for push).

## 🔌 Backend setup (Firebase, free tier, no billing)

### 1. Console setup (~10 min)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → turn **Analytics OFF** → Create.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
3. **Build → Firestore Database → Create database → Start in production mode** → pick your region → Enable. Then the **Rules** tab → paste `firestore.rules` → **Publish** (or deploy via CLI below).
4. **Project Overview → Add app (`</>`)** → nickname `together-web` → Register (skip Hosting) → copy `apiKey`, `authDomain`, `projectId`, `appId`.
5. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair** → copy the **VAPID key**.

### 2. Local config (never committed)

```bash
cp .env.example .env   # fill in the 5 values
```

Also paste the same 4 web-config values into `public/firebase-messaging-sw.js` where marked (FCM requires that file at the site root; web keys are public by design).

### 3. Deploy

```bash
npm i -g firebase-tools
firebase login --no-localhost
firebase use --add          # select your project
npm run build
firebase deploy --only firestore:rules,hosting
```

### 4. Free daily push (GitHub Actions)

1. [console.cloud.google.com](https://console.cloud.google.com) → your project → **IAM & Admin → Service Accounts → Create** (`together-scheduler`, **Firebase Admin** role) → Done.
2. Account → **Keys → Add key → JSON** (downloads a file).
3. GitHub repo → **Settings → Secrets and variables → Actions → New secret** `FIREBASE_SERVICE_ACCOUNT` = entire JSON → Add.
4. **Actions → daily-reminder → Run workflow** to test (runs every 15 min on its own).

### 5. Two-phone flow

Phone A: **Create invite** → share the 6-letter code. Phone B: **Join partner** → enter code. Answer + check in on both → reveal + streak sync live.

## 📁 Project structure

```
public/                  icons, lily artwork, firebase-messaging-sw.js
src/
  App.jsx                tabs, pairing gate, streak logic, desktop shell
  index.css              Tailwind v4 theme + rise/bloom/petal/ripple/flicker animations
  lib/
    content.js           prompt pool (32), quotes, moods, IST helpers
    store.js             local-first store (demo mode + offline cache)
    firebase.js          lazy SDK init, anon auth, FCM helpers
    sync.js              realtime layer: pairing, listeners, write-through
  components/
    Splash.jsx           staged boot splash
    Onboarding.jsx       5-step first-run tutorial
    DoodleCanvas.jsx     shared drawing canvas
scripts/reminder/        $0 cron push sender (Firestore REST + FCM HTTP v1)
functions/               optional Blaze-path Cloud Function equivalent
firestore.rules          members-only reads, single-use invite claims
firebase.json            hosting (dist) + rules + functions wiring
.github/workflows/       daily-reminder cron
```

## 📄 License

MIT — made with 💗 for couples with miles between them.
