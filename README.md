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
- 🕒 **Dual timezone clocks** + live status (free / working / sleeping / driving / out)
- 🎶 Song-of-the-day exchange + conversation deck

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

1. Copy `.env.example` to `.env` and fill in your Firebase web config:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`
2. Replace the local `loadState`/`saveState` in `src/lib/store.js` with Firestore reads/writes (`users/`, `pairs/`, `responses/`) + `onSnapshot` realtime sync — seams are marked in `src/lib/firebase.js`.
3. Wire FCM with the VAPID key for the daily prompt reminder (a local scheduler stand-in ships in the meantime).

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
