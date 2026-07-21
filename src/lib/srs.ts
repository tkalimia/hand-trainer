import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRS,
} from "ts-fsrs";
import type { CardProgress, CardState, Grade } from "./types";

// FSRS gives us per-card stability / difficulty / retrievability — the raw
// material for the "insight into my learning" dashboards.
let engine: FSRS | null = null;
let retention = 0.9;

export function configureSrs(desiredRetention: number) {
  retention = desiredRetention;
  engine = fsrs(generatorParameters({ enable_fuzz: true, request_retention: desiredRetention }));
}
function eng(): FSRS {
  if (!engine) configureSrs(retention);
  return engine!;
}

const stateToStr = (s: State): CardState =>
  s === State.New ? "new" : s === State.Learning ? "learning" : s === State.Relearning ? "relearning" : "review";
const strToState = (s: CardState): State =>
  s === "new" ? State.New : s === "learning" ? State.Learning : s === "relearning" ? State.Relearning : State.Review;

function toFsrs(cp: CardProgress): FsrsCard {
  return {
    due: new Date(cp.due),
    stability: cp.stability,
    difficulty: cp.difficulty,
    elapsed_days: cp.elapsedDays,
    scheduled_days: cp.scheduledDays,
    reps: cp.reps,
    lapses: cp.lapses,
    state: strToState(cp.state),
    last_review: cp.lastReview ? new Date(cp.lastReview) : undefined,
  } as FsrsCard;
}

function fromFsrs(id: string, c: FsrsCard, introduced: number | null): CardProgress {
  return {
    id,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: stateToStr(c.state),
    lastReview: c.last_review ? new Date(c.last_review).getTime() : null,
    introduced,
  };
}

export function newCard(id: string): CardProgress {
  return fromFsrs(id, createEmptyCard(new Date()), null);
}

/** Apply a grade (Again/Hard/Good/Easy) and return the updated card. */
export function grade(cp: CardProgress, g: Grade, now: Date = new Date()): CardProgress {
  const rec = eng().repeat(toFsrs(cp), now) as unknown as Record<number, { card: FsrsCard }>;
  const item = rec[g as unknown as Rating];
  return fromFsrs(cp.id, item.card, cp.introduced ?? now.getTime());
}

/** Human-readable next-interval preview for each of the four rating buttons. */
export function previewIntervals(cp: CardProgress, now: Date = new Date()): Record<Grade, string> {
  const rec = eng().repeat(toFsrs(cp), now) as unknown as Record<number, { card: FsrsCard }>;
  const out = {} as Record<Grade, string>;
  ([1, 2, 3, 4] as Grade[]).forEach((g) => {
    const due = rec[g as unknown as Rating].card.due;
    out[g] = humanInterval(new Date(due).getTime() - now.getTime());
  });
  return out;
}

/** Probability of recall right now (0–1). New/unseen → 0. */
export function retrievability(cp: CardProgress, now: Date = new Date()): number {
  if (cp.state === "new" || !cp.lastReview) return 0;
  const r = eng().get_retrievability(toFsrs(cp), now, false);
  return typeof r === "number" ? r : parseFloat(String(r)) || 0;
}

export function isDue(cp: CardProgress, now = Date.now()) {
  return cp.due <= now;
}

/** "Mature" ≈ well-retained long-term memory (stability ≥ 21 days). */
export function isMature(cp: CardProgress) {
  return cp.state === "review" && cp.stability >= 21;
}

export function humanInterval(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export { Rating };
