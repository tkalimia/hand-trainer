import type { CardProgress, QuestionBank, Settings, StudyMode } from "./types";
import { retrievability, isDue } from "./srs";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isNew = (cards: Map<string, CardProgress>, id: string) => {
  const c = cards.get(id);
  return !c || c.state === "new";
};

/** Build an ordered queue of question ids for a given study mode. */
export function buildQueue(
  mode: StudyMode,
  bank: QuestionBank,
  cards: Map<string, CardProgress>,
  settings: Settings,
  topicId?: string | null,
): string[] {
  const now = Date.now();
  const all = bank.questions;
  const mcqOnly = all.filter((q) => q.type !== "read");

  switch (mode) {
    case "review": {
      return all
        .filter((q) => {
          const c = cards.get(q.id);
          return c && c.state !== "new" && isDue(c, now);
        })
        .sort((a, b) => (cards.get(a.id)!.due - cards.get(b.id)!.due))
        .map((q) => q.id);
    }

    case "quick": {
      const due = all
        .filter((q) => {
          const c = cards.get(q.id);
          return c && c.state !== "new" && isDue(c, now);
        })
        .sort((a, b) => cards.get(a.id)!.due - cards.get(b.id)!.due)
        .map((q) => q.id);
      const fresh = shuffle(all.filter((q) => isNew(cards, q.id)).map((q) => q.id));
      return [...due, ...fresh].slice(0, settings.quickBatch);
    }

    case "learn": {
      return shuffle(all.filter((q) => isNew(cards, q.id)).map((q) => q.id)).slice(
        0,
        Math.max(settings.dailyNewGoal, 5),
      );
    }

    case "drill": {
      const pool = topicId ? all.filter((q) => q.topic === topicId) : all;
      return shuffle(pool.map((q) => q.id));
    }

    case "exam": {
      return shuffle(mcqOnly.map((q) => q.id)).slice(0, settings.examCount);
    }

    case "weak": {
      // Lowest predicted retrievability among introduced cards, tie-broken by difficulty.
      const introduced = all
        .map((q) => ({ q, c: cards.get(q.id) }))
        .filter((x) => x.c && x.c.state !== "new") as { q: (typeof all)[number]; c: CardProgress }[];
      return introduced
        .map((x) => ({ id: x.q.id, r: retrievability(x.c), d: x.c.difficulty }))
        .sort((a, b) => a.r - b.r || b.d - a.d)
        .slice(0, Math.max(settings.quickBatch * 2, 10))
        .map((x) => x.id);
    }

    default:
      return [];
  }
}

/** Counts used to enable/disable modes and show badges on the Home screen. */
export function modeCounts(bank: QuestionBank, cards: Map<string, CardProgress>) {
  const now = Date.now();
  let due = 0;
  let fresh = 0;
  let introduced = 0;
  for (const q of bank.questions) {
    const c = cards.get(q.id);
    if (!c || c.state === "new") fresh++;
    else {
      introduced++;
      if (isDue(c, now)) due++;
    }
  }
  return { due, fresh, introduced, total: bank.questions.length };
}
