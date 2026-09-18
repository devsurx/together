// Rotating boot quotes, daily prompt pool, conversation library.
// All local so the app works fully offline in demo mode.

export const BOOT_QUOTES = [
  "You are my favorite notification.",
  "Miles apart, synced at heart.",
  "Same moon, same us.",
  "Home is wherever your voice is.",
  "A lily blooms — so do we, daily.",
  "Distance is just a plot twist.",
  "Good morning from your favorite timezone.",
  "One prompt a day keeps the distance away.",
  "We are closer than our miles suggest.",
  "Pressed flowers last; so do we.",
  "Your voice is my favorite place.",
  "Two timezones, one team.",
  "Loved loudly, across latitudes.",
  "Every check-in is a small 'I choose you'.",
];

export function bootQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return BOOT_QUOTES[day % BOOT_QUOTES.length];
}

export const DAILY_PROMPTS = [
  "What is one small thing I did lately that made you feel loved?",
  "What are you most looking forward to doing together next visit?",
  "What did you dream about last night — or wish you had?",
  "What is something you've been missing about us this week?",
  "Describe your perfect slow Sunday together, hour by hour.",
  "What is one thing you're grateful your partner understands about you?",
  "What song reminds you of us right now, and why?",
  "What is a tiny habit we should start together, even apart?",
  "When did you feel proudest of us as a couple?",
  "What would you cook for me if we were in the same kitchen tonight?",
  "What is stressing you out that I can carry a little of?",
  "What is a childhood memory you haven't told me yet?",
  "If we had a free weekend anywhere, where would we go?",
  "What does 'home' smell / sound / feel like to you?",
  "What is one thing you want to get better at — for yourself, for us?",
  "What made you laugh today?",
  "What is your love language today: words, time, gifts, touch, acts?",
  "What is one fear about the distance we should name out loud?",
  "What is one win from today, however small?",
  "What would our future pet's name be? Defend your answer.",
  "What movie should we watch-together next, and why that one?",
  "What is the kindest thing a stranger ever did for you?",
  "What do you need more of from me this week?",
  "What do you need less of from me this week?",
  "If our story were a book title, what chapter are we in?",
  "What is a compliment you haven't given me in a while?",
  "What time of day do you miss me most?",
  "What would you put on our shared bucket list today?",
  "What is something I do long-distance that actually works?",
  "What is one thing we should celebrate that we usually skip?",
  "What would you write on a doodle note to me right now?",
  "What does a perfect goodnight message from me look like?",
];

export function promptForDate(dateKey) {
  // Deterministic: hash the date string into the pool
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return DAILY_PROMPTS[h % DAILY_PROMPTS.length];
}

export const CONVERSATION_LIBRARY = [
  "What is something you believed as a kid that turned out wrong in a funny way?",
  "Which of your parents' traits do you hope we inherit as a couple?",
  "What is a hard thing you survived that I may not fully appreciate?",
  "How do you want to be comforted when words don't help?",
  "What is your earliest memory of feeling safe?",
  "What would you do with an extra hour together every day?",
  "What tradition should we invent that is only ours?",
  "When do you feel most attractive — and how can I remind you?",
  "What is a boundary that actually helps you love better?",
  "What would you tell couple-us from one year ago?",
];

export const MOODS = [
  { id: "glowing", emoji: "🥰", label: "glowing" },
  { id: "good", emoji: "😊", label: "good" },
  { id: "okay", emoji: "😐", label: "okay" },
  { id: "low", emoji: "😔", label: "low" },
  { id: "rough", emoji: "😭", label: "rough" },
];

export const STATUSES = ["free", "working", "sleeping", "driving", "out"];

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Bucharest",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function todayKey(tz) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function fmtTime(tz) {
  try {
    return new Intl.DateTimeFormat([], {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}
