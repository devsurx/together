# Together 🌸

A lightweight, mobile-first **Progressive Web App (PWA)** for long-distance couples. One shared daily prompt, one mood check-in, one visible streak — a 60-second ritual designed so both partners actually open it every day.

> "Miles apart, synced at heart."

## ✨ Features

**Core daily loop (MVP)**
- 📝 **Daily prompt** — one shared question per day; answers stay locked until *both* partners respond, then reveal simultaneously
- 😊 **Mood check-in** — a quick emoji tap showing how each partner feels that day
- 🔥 **Streak counter** — grows when both check in on the same day, with one forgiven miss (grace save)

**Connection & presence**
- 💓 **Thinking-of-you button** — instant buzz + petal burst for your partner
- 🏮 **Shared lamp** — light it up and your partner sees it glowing
- 🟢 **Live status** (free / working / sleeping / driving / out) — no more "are you busy?"
- 🇮🇳 **IST-locked** — one timezone for everyone, zero clock math

**Shared experience**
- ✍️ **Doodle tab** — finger-drawn scribbles sent to a shared scrapbook feed
- ✈️ **Visit countdown** with milestones, points system, journal timeline, bucket list
- 🌸 **Onboarding tour + splash screen**, installable to the home screen with daily reminders

**Design** — romantic, moody, a little magical: black canvas, rose/pink accents, lily-flower motif with bloom/fade/petal animations.

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| PWA | `vite-plugin-pwa` (manifest + Workbox service worker) |
| Backend (roadmap) | Firebase (Firestore + Auth + FCM) — app currently runs in **local demo mode**, no backend needed |
| Push (roadmap) | Firebase Cloud Messaging; local reminder stand-in included |

### Data model (mirrors the Firestore schema)

```
users/{uid}                  { name, partnerId, timezone, fcmToken }
pairs/{pairId}               { user1, user2, streakCount, lastCheckIn }
dailyPrompts/{date}          { question }
responses/{pairId}/{date}/{uid}  { answer, mood, submittedAt }
```

## 🚀 Getting started

Requirements: Node.js 18+.

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # production build + service worker
npm run preview  # preview the production build
```

**Demo tip:** the header `You / Partner` toggle simulates both phones — answer + check in as one, switch, then answer as the other to watch the locked → reveal → streak transition.

## 📲 Install as an app

The production build is installable: on your phone open the hosted URL → **Share → Add to Home Screen**. Daily reminder time + notification permission live in the **Us → Settings** tab.

## 🔌 Going live with Firebase

The app ships in **local demo mode**. To get true two-phone realtime sync + daily push, wire up Firebase (anonymous auth, Firestore, FCM) — **fully free, no billing/Blaze needed**: the daily reminder runs as a GitHub Actions cron instead of a Cloud Function.

**What syncs vs what stays on-device:**

| Synced (Firestore) | Local-only (this device) |
|---|---|
| profiles, pair core, moods + answers, nudges, lamp, song, visit countdown | doodles, journal, bucket list, points, activity feed |

### 1. Console setup (~10 min)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it e.g. `together-couples` → turn **Analytics OFF** → Create.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
3. **Build → Firestore Database → Create database → Start in production mode** → pick your region → Enable. Then open the **Rules** tab, paste `firestore.rules` from this repo → **Publish**. (Or deploy it via CLI in step 3 below.)
4. **Project Overview → Add app ( `</>` )** → nickname `together-web` → Register (skip Hosting for now) → copy `apiKey`, `authDomain`, `projectId`, `appId`.
5. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair** → copy the **VAPID key**.
6. **Skip Blaze entirely** — the daily push runs via GitHub Actions (step 4), so no billing account is ever needed. (`functions/` holds an equivalent Cloud Function if you ever want the Blaze path later.)

### 2. Local config (never committed)

```bash
cp .env.example .env   # then fill in the 5 values from step 1
```

Also paste the same 4 web-config values into `public/firebase-messaging-sw.js` where marked (FCM requires that file at the site root; web keys are public by design).

### 3. Deploy (your terminal)

```bash
npm i -g firebase-tools
firebase login --no-localhost
firebase use --add          # select your project
npm run build
firebase deploy --only firestore:rules,hosting
```

Your public URL (Hosting) is what both phones open — installable via **Share → Add to Home Screen**, and push-capable over HTTPS. Each phone taps **enable 🔔** in **Us → Settings** once to register for the daily prompt push (sent at each person's `reminderTime` in their own timezone).

### 4. Free daily push (GitHub Actions, no Blaze)

1. [console.cloud.google.com](https://console.cloud.google.com) → select your project → **IAM & Admin → Service Accounts → Create service account** → name `together-scheduler` → grant the **Firebase Admin** role → Done.
2. Open the account → **Keys → Add key → Create new key → JSON** (downloads a file).
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**: name `FIREBASE_SERVICE_ACCOUNT`, value = the entire JSON file contents → Add secret.
4. **Actions tab → daily-reminder → Run workflow** to test (it also runs every 15 min automatically).

That's it — due devices get the prompt push, `lastReminded` prevents duplicates, stale tokens are cleared automatically.

### 4. Two-phone flow

Phone A: **Create invite** → share the 6-letter code. Phone B: **Join partner** → enter code. Both answer + check in → reveal + streak sync live (`● live sync` in the header; `○ offline` means it fell back to local).

## 📁 Project structure

```
public/                  icons, lily artwork, PWA assets
src/
  App.jsx                tabs, pairing gate, streak logic, desktop shell
  index.css              Tailwind v4 theme + bloom/petal/drift animations
  lib/
    content.js           prompt pool, quotes, moods, timezones
    store.js             local-first store (mirrors Firestore schema)
    firebase.js          Firebase config stub + reminder helpers
  components/
    Splash.jsx           staged boot splash screen
    Onboarding.jsx       5-step first-run tutorial
    DoodleCanvas.jsx     shared drawing canvas
```

## 📄 License

MIT — made with 💗 for couples with miles between them.
