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

The app is hosted on **GitHub Pages** (always-on HTTPS): **https://tkalimia.github.io/hand-trainer/**.
Questions are authored as per-topic files and can either travel with the app or live on Dropbox.

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

## Adding questions — organised by topic (the whole point)

You author questions **one file per topic**, and a single command assembles them into the
bank the app loads. This keeps each subject self-contained and makes cataloguing topics trivial.

```
bank-src/
  topics.json          ← the TOPIC CATALOG (list/rename/reorder/colour your topics)
  _TEMPLATE.jsonc      ← the question TEMPLATE — copy blocks from here
  anatomy.json         ← every "Anatomy" question (a JSON array)
  flexor-tendon.json   ← every "Flexor Tendon" question
  nerve.json  fracture.json  soft-tissue.json  …
```

### 1. Catalog a topic

Edit [`bank-src/topics.json`](bank-src/topics.json) — add one line to the `topics` array.
Order in the list = order in the app (Browse, Plan curriculum):

```jsonc
{ "id": "arthritis", "name": "Arthritis", "color": "#7a4fbb", "description": "Optional note" }
```

Then create a matching file `bank-src/arthritis.json` (start it as `[]`).

### 2. Prep questions

Open [`bank-src/_TEMPLATE.jsonc`](bank-src/_TEMPLATE.jsonc), copy a block into the topic file,
fill it in. A topic file is just a JSON **array** of questions. The minimum is a `stem` (+ `options`
for multiple choice) — **you don't write `topic` or `id`**; the topic comes from the filename and a
stable `id` is generated from the question text automatically.

```jsonc
// bank-src/arthritis.json
[
  {
    "type": "mcq",                                  // "mcq" | "multi" | "read"
    "difficulty": "medium",                         // optional
    "stem": "Question text. **Markdown** works.",
    "images": [{ "src": "images/xray.png", "caption": "…" }],   // optional
    "options": [
      { "text": "Correct answer", "correct": true },
      { "text": "Distractor",     "correct": false }
    ],
    "explanation": "Shown after answering. Markdown works.",
    "references": ["Green's Operative Hand Surgery, 8e"]        // optional
  }
]
```

- **`type: "read"`** = a text + image study card with no options — still spaced-repetition scheduled.
- Drop any referenced images into [`public/bank/images/`](public/bank/images/).

### 3. Assemble + check

```bash
npm run bank      # merges bank-src/ → public/bank/questions.json, validates everything
```

It prints a per-topic count and refuses to write if anything is wrong (missing correct answer,
duplicate id, an `mcq` with two correct options, a topic file not in the catalog, …).

### 4. Publish

```bash
npm run deploy:pages   # rebuilds the bank + redeploys the live app in one step
```

> **Using topics in the app:** Browse → tap a topic to drill it; the Plan tab walks the topics
> in catalog order as a curriculum; Stats shows mastery per topic. All driven by the catalog above.

> **Want to update content without redeploying?** Point the app at Dropbox instead
> (Settings → Question bank source) and copy the generated `public/bank/questions.json`
> + `images/` into your Dropbox folder — see below. Otherwise the bundled bank travels with the app.

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

The app is hosted on **GitHub Pages** (always-on HTTPS, no VPN needed):

- **Live:** https://tkalimia.github.io/hand-trainer/
- **Repo:** https://github.com/tkalimia/hand-trainer

```bash
npm run deploy:pages   # assemble bank → build → publish to gh-pages branch
```

Install on the iPhone (once):

1. Open **https://tkalimia.github.io/hand-trainer/** in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch **HandTrainer** — full-screen, its own icon, works offline afterward. No VPN needed.

> `scripts/deploy.sh` (NAS + Tailscale HTTPS) is kept as an alternative self-hosted option, but
> Tailscale HTTPS certificates must be enabled in the admin console for it to work.

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
bank-src/       topics.json (catalog) · <topic>.json (per-topic questions) · _TEMPLATE.jsonc
public/bank/    generated questions.json (via `npm run bank`) + images/
scripts/        build-bank.mjs · validate-questions.mjs · deploy-pages.sh · deploy.sh
```
