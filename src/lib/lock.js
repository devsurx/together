// App-lock helpers: salted PIN hashing.
//
// Honest scope: this is casual privacy (stops snoopers opening the app),
// not encryption — data in localStorage/Firestore is still readable by the
// device owner with technical means.

export function makeSalt() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function hashPin(pin, salt) {
  const msg = `${salt}::${pin}`;
  try {
    if (window.crypto?.subtle) {
      const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through to non-crypto hash */
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < msg.length; i++) {
    const ch = msg.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}
