import type { QuestionBank, Settings } from "./types";
import { cacheBank, getCachedBank } from "./db";

/**
 * Swappable question-bank loader.
 *
 *   bundled       → the sample bank shipped with the app (/bank/questions.json)
 *   nas           → a folder served from the NAS over Tailscale (settings.nasUrl)
 *   dropbox-link  → a public shared ?dl=1 link to questions.json
 *   dropbox-app   → a scoped Dropbox app-folder via access token (private, reliable CORS)
 *
 * Always falls back to the last-synced bank in IndexedDB when offline, so the
 * app keeps working in dead-space moments with no connectivity.
 */

export interface LoadedBank {
  bank: QuestionBank;
  /** Resolve an authored image `src` to a displayable URL. */
  resolveImage: (src: string) => string;
  fromCache: boolean;
}

const isAbsolute = (s: string) => /^(https?:)?\/\//.test(s) || s.startsWith("blob:") || s.startsWith("data:");

function baseResolver(baseUrl: string) {
  return (src: string) => (isAbsolute(src) ? src : baseUrl.replace(/\/?$/, "/") + src.replace(/^\//, ""));
}

// Normalise a Dropbox "share" link into a direct-download link.
function directDropboxLink(link: string): string {
  try {
    const u = new URL(link);
    if (u.hostname.includes("dropbox.com")) {
      u.searchParams.set("dl", "1");
    }
    return u.toString();
  } catch {
    return link;
  }
}

async function fetchJSON(url: string, init?: RequestInit): Promise<QuestionBank> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading question bank`);
  return (await res.json()) as QuestionBank;
}

// ── Dropbox app-folder helpers ───────────────────────────────────────────
async function dropboxDownloadJSON(token: string, path = "/questions.json"): Promise<QuestionBank> {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error(`Dropbox download failed (HTTP ${res.status})`);
  return (await res.json()) as QuestionBank;
}

async function dropboxTempLink(token: string, path: string): Promise<string> {
  const res = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: path.startsWith("/") ? path : `/${path}` }),
  });
  if (!res.ok) throw new Error(`Dropbox temp link failed (HTTP ${res.status})`);
  const data = (await res.json()) as { link: string };
  return data.link;
}

// Prefetch Dropbox images into a persistent Cache so they survive temp-link
// expiry and work offline. Returns a src→objectURL map.
async function resolveDropboxImages(token: string, bank: QuestionBank): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const srcs = new Set<string>();
  for (const q of bank.questions) for (const img of q.images || []) if (!isAbsolute(img.src)) srcs.add(img.src);
  if (!srcs.size) return map;

  const cache = "caches" in self ? await caches.open("bank-images") : null;
  for (const src of srcs) {
    const key = `/__bank_img__/${src}`;
    try {
      let resp = cache ? await cache.match(key) : undefined;
      if (!resp || !navigator.onLine) {
        if (!resp) {
          const link = await dropboxTempLink(token, src);
          const fetched = await fetch(link);
          if (fetched.ok && cache) await cache.put(key, fetched.clone());
          resp = fetched;
        }
      }
      if (resp && resp.ok) {
        const blob = await resp.blob();
        map.set(src, URL.createObjectURL(blob));
      }
    } catch {
      /* leave unresolved — QuestionCard will show a placeholder */
    }
  }
  return map;
}

export async function loadBank(settings: Settings): Promise<LoadedBank> {
  const base = import.meta.env.BASE_URL || "/";
  try {
    let bank: QuestionBank;
    let resolveImage: (src: string) => string;

    switch (settings.source) {
      case "nas": {
        const url = settings.nasUrl?.replace(/\/?$/, "/") || `${base}bank/`;
        bank = await fetchJSON(url + "questions.json");
        resolveImage = baseResolver(url);
        break;
      }
      case "dropbox-link": {
        if (!settings.dropboxLink) throw new Error("No Dropbox link configured");
        bank = await fetchJSON(directDropboxLink(settings.dropboxLink));
        // Images should be absolute URLs in link mode (documented in README).
        resolveImage = baseResolver(`${base}bank/`);
        break;
      }
      case "dropbox-app": {
        if (!settings.dropboxToken) throw new Error("No Dropbox token configured");
        bank = await dropboxDownloadJSON(settings.dropboxToken);
        const imgs = await resolveDropboxImages(settings.dropboxToken, bank);
        resolveImage = (src) => imgs.get(src) ?? baseResolver(`${base}bank/`)(src);
        break;
      }
      case "bundled":
      default: {
        bank = await fetchJSON(`${base}bank/questions.json`);
        resolveImage = baseResolver(`${base}bank/`);
        break;
      }
    }

    await cacheBank(bank);
    return { bank, resolveImage, fromCache: false };
  } catch (err) {
    // Offline / source unreachable → last-synced bank.
    const cached = await getCachedBank();
    if (cached) {
      return { bank: cached, resolveImage: baseResolver(`${base}bank/`), fromCache: true };
    }
    throw err;
  }
}
