import type { SessionSnapshot } from "./types";

// The resume snapshot lives in localStorage: synchronous, survives tab kills,
// and is written on every "the app is going away" signal so we never lose the
// user's place — even if iOS suspends Safari mid-question after an hour.
const KEY = "ht.session.v1";

export function saveSession(s: SessionSnapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionSnapshot;
    if (!s.queue || !s.queue.length) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Register lifecycle listeners that persist a live snapshot the instant the
 * app is backgrounded/hidden/frozen. `getSnapshot` returns null when no study
 * session is active. Returns an unsubscribe function.
 */
export function installSessionAutosave(getSnapshot: () => SessionSnapshot | null) {
  const flush = () => {
    const snap = getSnapshot();
    if (snap) saveSession(snap);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  window.addEventListener("freeze", flush as EventListener); // Page Lifecycle API
  window.addEventListener("blur", flush);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("freeze", flush as EventListener);
    window.removeEventListener("blur", flush);
  };
}
