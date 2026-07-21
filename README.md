# Hand Surgery Trainer

A sophisticated, **installable iPhone web app (PWA)** for learning hand surgery in the
dead-space moments of your day. Text + images + multiple-choice questions, spaced
repetition (FSRS), real learning analytics, and **exact resume** — pick up on the same
question even after the phone has been asleep for an hour.

Built on your existing design system (Heebo, drbrutus palette, teal-navy accent) with a
polished dark mode.

---

## Why a PWA (and not a native app)

- Installs to the Home Screen, runs full-screen with its own icon & splash, works offline.
- No Xcode, no App Store, no yearly fee, no 7-day re-signing.
- Updates instantly — you just redeploy.
- Reuses your CSS design system directly.

The app **shell** is hosted on your NAS (Tailscale HTTPS). The **question bank** lives on
Dropbox so you can add questions by editing a file.

---

## Run locally

```bash
npm install
npm run dev            # http://localhost:5199  (open on your Mac or phone on the LAN)
npm run build          # production build → dist/
npm run preview        # serve the built app (tests the offline service worker)
npm run validate       # lint the sample question bank
```

---

## Adding questions (the whole point)

Questions live in a single **`questions.json`** file plus an **`images/`** folder. The
bundled sample is at [`public/bank/`](public/bank/). To add a question, append one object:

```jsonc
{
  "id": "ft-011",                 // unique, lowercase-kebab
  "topic": "flexor-tendon",       // must match a topic id below
  "type": "mcq",                  // "mcq" | "multi" | "read"
  "difficulty": "medium",         // easy | medium | hard  (optional)
  "stem": "Markdown question text. **Bold** allowed.",
  "images": [                     // optional
    { "src": "images/zones.png", "caption": "Verdan zones", "alt": "…" }
  ],
  "options": [                    // required for mcq / multi
    { "text": "Zone II", "correct": true },
    { "text": "Zone I",  "correct": false }
  ],
  "explanation": "Markdown shown after answering.",
  "references": ["Green's Operative Hand Surgery, 8e"],
  "tags": ["zones", "anatomy"]
}
```

- **`type: "read"`** = a text + image study card with no options (for learning new material).
  It's still scheduled by spaced repetition.
- Add a new **topic** by adding to the `topics` array: `{ "id": "…", "name": "…", "order": N, "color": "#…" }`.
- Drop any referenced images into the `images/` folder next to `questions.json`.
- **Always validate before publishing:** `node scripts/validate-questions.mjs path/to/questions.json`
  (checks ids are unique, topics resolve, MCQs have exactly one correct answer, etc.).

The JSON schema lives in [`content/schema.json`](content/schema.json).

### Publishing the bank to Dropbox

Open the app → **Settings → Question bank source**, then pick one:

- **Dropbox app folder (recommended, private).** Create a Dropbox *app* (scoped access,
  "App folder"), generate an access token, paste it into Settings. Put `questions.json`
  and `images/` in that app folder. The app downloads them via the Dropbox API (reliable,
  private, caches images for offline). Add a question = edit the file in the folder → **Sync**.
- **Dropbox link (simplest, public).** Share `questions.json` and copy the link; paste it
  into Settings. Use full `https://…` image URLs inside the bank in this mode.
- **NAS (Tailscale).** Serve a `bank/` folder from the NAS and point Settings at it, e.g.
  `https://kalimian.tail953b96.ts.net/bank/`.
- **Bundled sample.** The 10 sample questions shipped with the app (default).

The bank is cached in the browser, so once synced the app works offline.

---

## Deploy to your iPhone

```bash
npm run deploy         # build → rsync to NAS → Caddy container → Tailscale HTTPS
```

`scripts/deploy.sh` builds, copies `dist/` to the NAS (`ssh nas`), runs a small Caddy
static-file container, and exposes it over HTTPS on your tailnet. Override any of
`NAS_SSH`, `REMOTE_DIR`, `HTTP_PORT`, `TS_HOSTNAME` via env vars.

Then, **on the iPhone (Tailscale on):**

1. Open `https://kalimian.tail953b96.ts.net/` in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the Home Screen — full-screen, offline, its own icon.

> One-time manual step if `tailscale serve` can't run over SSH:
> `ssh nas` then `sudo tailscale serve --bg --https=443 http://127.0.0.1:8096`
>
> *Alternative host:* the shell is just static files — you can also publish `dist/` to
> GitHub Pages for always-on HTTPS (the private question bank stays on Dropbox).

---

## Features

- **Learning modes:** Quick (1-minute burst), Review (due cards), Learn (new material),
  Topic drill, Exam simulation (timed, scored), Weak spots.
- **Spaced repetition:** FSRS — per-card stability / difficulty / retrievability.
- **Resume exactly where you left off:** the live session (question, selection, scroll,
  timer) is snapshotted whenever the app is hidden *and* after every step, so a phone
  sleep or a full app kill both resume precisely.
- **Insights:** cards seen, retention, mastery by topic, review-load forecast, activity
  calendar, *when-you-study* hour heatmap, learning velocity, weak-topic detection.
- **Plans:** daily new/review goals, streaks, curriculum path, exam-ready estimate.
- **Offline-first:** service worker precaches the shell; question JSON and images are
  cached after first sync.
- **Design:** your Heebo + drbrutus design system, LTR, with an OLED dark mode.

---

## Project layout

```
src/lib/        contentSource · db (IndexedDB) · srs (FSRS) · session (resume) · stats · queue · store
src/screens/    Home · Study · Stats · Plan · Browse · Settings
src/components/  TabBar · Markdown · charts · icons
src/styles/     app-tokens.css (design system + dark mode + iOS tokens) · app.css
public/bank/    bundled sample questions.json + images
scripts/        validate-questions.mjs · deploy.sh · gen-icons (via sips)
```
