import type { CardProgress, ReviewLog, DayActivity, QuestionBank } from "./types";
import { retrievability, isMature, isDue } from "./srs";

// ── Date helpers (local time) ────────────────────────────────────────────
export function dateKey(ts: number | Date): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function todayKey() {
  return dateKey(Date.now());
}
function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Headline summary ─────────────────────────────────────────────────────
export interface Summary {
  total: number;
  introduced: number;
  newAvailable: number;
  dueNow: number;
  mature: number;
  reviewsToday: number;
  correctToday: number;
  studyMsToday: number;
  accuracy7d: number; // 0–1
  retentionAvg: number; // avg predicted retrievability of seen cards
  streak: number;
}

export function summarize(
  bank: QuestionBank,
  cards: Map<string, CardProgress>,
  reviews: ReviewLog[],
  days: DayActivity[],
): Summary {
  const now = Date.now();
  const total = bank.questions.length;
  let introduced = 0;
  let dueNow = 0;
  let mature = 0;
  let retSum = 0;
  let retCount = 0;

  for (const q of bank.questions) {
    const c = cards.get(q.id);
    if (!c || c.state === "new") continue;
    introduced++;
    if (isDue(c, now)) dueNow++;
    if (isMature(c)) mature++;
    retSum += retrievability(c);
    retCount++;
  }
  const newAvailable = total - introduced;

  const today = todayKey();
  const td = days.find((d) => d.date === today);
  const weekAgo = addDays(new Date(), -7).getTime();
  const recent = reviews.filter((r) => r.ts >= weekAgo);
  const correct7 = recent.filter((r) => r.correct).length;

  return {
    total,
    introduced,
    newAvailable,
    dueNow,
    mature,
    reviewsToday: td?.reviews ?? 0,
    correctToday: td?.correct ?? 0,
    studyMsToday: td?.studyMs ?? 0,
    accuracy7d: recent.length ? correct7 / recent.length : 0,
    retentionAvg: retCount ? retSum / retCount : 0,
    streak: computeStreak(days),
  };
}

export function computeStreak(days: DayActivity[]): number {
  const active = new Set(days.filter((d) => d.reviews > 0).map((d) => d.date));
  let streak = 0;
  let cursor = new Date();
  // Allow the streak to "start" today or yesterday.
  if (!active.has(dateKey(cursor))) cursor = addDays(cursor, -1);
  while (active.has(dateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// ── Topic mastery (from FSRS stability + coverage) ───────────────────────
export interface TopicMastery {
  id: string;
  name: string;
  color?: string;
  total: number;
  introduced: number;
  mastery: number; // 0–1 combined coverage × retention
  accuracy: number; // historical, 0–1
}

export function topicMastery(
  bank: QuestionBank,
  cards: Map<string, CardProgress>,
  reviews: ReviewLog[],
): TopicMastery[] {
  const accByTopic = new Map<string, { c: number; n: number }>();
  for (const r of reviews) {
    const a = accByTopic.get(r.topic) || { c: 0, n: 0 };
    a.c += r.correct ? 1 : 0;
    a.n += 1;
    accByTopic.set(r.topic, a);
  }
  return bank.topics
    .map((t) => {
      const qs = bank.questions.filter((q) => q.topic === t.id);
      let introduced = 0;
      let retSum = 0;
      for (const q of qs) {
        const c = cards.get(q.id);
        if (c && c.state !== "new") {
          introduced++;
          retSum += retrievability(c);
        }
      }
      const coverage = qs.length ? introduced / qs.length : 0;
      const retention = introduced ? retSum / introduced : 0;
      const acc = accByTopic.get(t.id);
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        total: qs.length,
        introduced,
        mastery: coverage * retention,
        accuracy: acc && acc.n ? acc.c / acc.n : 0,
      };
    })
    .sort((a, b) => (b.total || 0) - (a.total || 0));
}

export function weakTopics(topics: TopicMastery[]): TopicMastery[] {
  return [...topics]
    .filter((t) => t.introduced > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3);
}

// ── Review-load forecast (upcoming due counts) ───────────────────────────
export function forecast(cards: Map<string, CardProgress>, days = 30): { date: string; count: number }[] {
  const start = new Date();
  const buckets: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) buckets.push({ date: dateKey(addDays(start, i)), count: 0 });
  const idx = new Map(buckets.map((b, i) => [b.date, i]));
  const todayIdx = 0;
  for (const c of cards.values()) {
    if (c.state === "new") continue;
    const k = dateKey(c.due);
    if (idx.has(k)) buckets[idx.get(k)!].count++;
    else if (c.due < start.getTime()) buckets[todayIdx].count++; // overdue → today
  }
  return buckets;
}

// ── Calendar heatmap (last N weeks of activity) ──────────────────────────
export function calendarMatrix(days: DayActivity[], weeks = 17): { date: string; reviews: number }[] {
  const map = new Map(days.map((d) => [d.date, d.reviews]));
  const total = weeks * 7;
  const start = addDays(new Date(), -(total - 1));
  const out: { date: string; reviews: number }[] = [];
  for (let i = 0; i < total; i++) {
    const k = dateKey(addDays(start, i));
    out.push({ date: k, reviews: map.get(k) ?? 0 });
  }
  return out;
}

// ── Time-of-day heatmap (when does he actually study?) ───────────────────
export function timeOfDay(reviews: ReviewLog[]): { hour: number; count: number; accuracy: number }[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, correct: 0 }));
  for (const r of reviews) {
    const h = new Date(r.ts).getHours();
    buckets[h].count++;
    if (r.correct) buckets[h].correct++;
  }
  return buckets.map((b) => ({ hour: b.hour, count: b.count, accuracy: b.count ? b.correct / b.count : 0 }));
}

// ── Retention / accuracy over time (daily) ───────────────────────────────
export function accuracyOverTime(reviews: ReviewLog[], days = 21): { date: string; accuracy: number; n: number }[] {
  const start = addDays(new Date(), -(days - 1));
  const out: { date: string; c: number; n: number }[] = [];
  for (let i = 0; i < days; i++) out.push({ date: dateKey(addDays(start, i)), c: 0, n: 0 });
  const idx = new Map(out.map((o, i) => [o.date, i]));
  for (const r of reviews) {
    const k = dateKey(r.ts);
    if (idx.has(k)) {
      const o = out[idx.get(k)!];
      o.n++;
      if (r.correct) o.c++;
    }
  }
  return out.map((o) => ({ date: o.date, accuracy: o.n ? o.c / o.n : 0, n: o.n }));
}

// ── Learning velocity ────────────────────────────────────────────────────
export interface Velocity {
  learnedThisWeek: number;
  reviewsThisWeek: number;
  avgResponseMs: number;
  matureShare: number; // of introduced
}
export function velocity(cards: Map<string, CardProgress>, reviews: ReviewLog[]): Velocity {
  const weekAgo = addDays(new Date(), -7).getTime();
  const introduced = [...cards.values()].filter((c) => c.state !== "new");
  const learnedThisWeek = introduced.filter((c) => (c.introduced ?? 0) >= weekAgo).length;
  const recent = reviews.filter((r) => r.ts >= weekAgo);
  const mature = introduced.filter(isMature).length;
  return {
    learnedThisWeek,
    reviewsThisWeek: recent.length,
    avgResponseMs: recent.length ? recent.reduce((s, r) => s + r.elapsedMs, 0) / recent.length : 0,
    matureShare: introduced.length ? mature / introduced.length : 0,
  };
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
