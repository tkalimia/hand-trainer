import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CardProgress, ReviewLog, DayActivity, QuestionBank } from "./types";

interface TrainerDB extends DBSchema {
  cards: { key: string; value: CardProgress };
  reviews: {
    key: string;
    value: ReviewLog;
    indexes: { "by-ts": number; "by-card": string; "by-topic": string };
  };
  days: { key: string; value: DayActivity };
  meta: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<TrainerDB>> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB<TrainerDB>("hand-trainer", 1, {
      upgrade(d) {
        d.createObjectStore("cards", { keyPath: "id" });
        const r = d.createObjectStore("reviews", { keyPath: "id" });
        r.createIndex("by-ts", "ts");
        r.createIndex("by-card", "cardId");
        r.createIndex("by-topic", "topic");
        d.createObjectStore("days", { keyPath: "date" });
        d.createObjectStore("meta");
      },
    });
  }
  return dbp;
}

// ── Cards ────────────────────────────────────────────────────────────────
export async function getCard(id: string) {
  return (await db()).get("cards", id);
}
export async function getAllCards() {
  return (await db()).getAll("cards");
}
export async function getCardsMap() {
  const all = await getAllCards();
  return new Map(all.map((c) => [c.id, c]));
}
export async function putCard(card: CardProgress) {
  return (await db()).put("cards", card);
}

// ── Reviews ──────────────────────────────────────────────────────────────
export async function addReview(log: ReviewLog) {
  return (await db()).add("reviews", log);
}
export async function getAllReviews() {
  return (await db()).getAllFromIndex("reviews", "by-ts");
}
export async function getReviewsForCard(cardId: string) {
  return (await db()).getAllFromIndex("reviews", "by-card", cardId);
}

// ── Day activity (for streaks / heatmaps) ────────────────────────────────
export async function getDay(date: string) {
  return (await db()).get("days", date);
}
export async function getAllDays() {
  return (await db()).getAll("days");
}
export async function bumpDay(patch: {
  date: string;
  reviews?: number;
  correct?: number;
  newCards?: number;
  studyMs?: number;
}) {
  const d = await db();
  const existing =
    (await d.get("days", patch.date)) ||
    ({ date: patch.date, reviews: 0, correct: 0, newCards: 0, studyMs: 0 } as DayActivity);
  existing.reviews += patch.reviews ?? 0;
  existing.correct += patch.correct ?? 0;
  existing.newCards += patch.newCards ?? 0;
  existing.studyMs += patch.studyMs ?? 0;
  await d.put("days", existing);
  return existing;
}

// ── Meta (cached bank, misc key/value) ───────────────────────────────────
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get("meta", key) as Promise<T | undefined>;
}
export async function setMeta(key: string, value: unknown) {
  return (await db()).put("meta", value, key);
}
export async function cacheBank(bank: QuestionBank) {
  return setMeta("bank", bank);
}
export async function getCachedBank() {
  return getMeta<QuestionBank>("bank");
}

// ── Danger zone (Settings → reset progress) ──────────────────────────────
export async function resetProgress() {
  const d = await db();
  await Promise.all([d.clear("cards"), d.clear("reviews"), d.clear("days")]);
}
