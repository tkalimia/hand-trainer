import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CardProgress,
  DayActivity,
  Grade,
  Question,
  QuestionBank,
  ReviewLog,
  Settings,
  StudyMode,
} from "./types";
import { loadBank } from "./contentSource";
import { DEFAULT_SETTINGS, applyTheme, loadSettings, saveSettings } from "./settings";
import { configureSrs, grade as srsGrade, newCard } from "./srs";
import {
  addReview,
  bumpDay,
  getAllCards,
  getAllDays,
  getAllReviews,
  putCard,
  resetProgress as dbReset,
} from "./db";
import { todayKey } from "./stats";

interface AppState {
  ready: boolean;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  bank: QuestionBank | null;
  resolveImage: (src: string) => string;
  settings: Settings;
  cards: Map<string, CardProgress>;
  reviews: ReviewLog[];
  days: DayActivity[];
  reloadBank: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  recordAnswer: (args: {
    question: Question;
    grade: Grade;
    correct: boolean;
    elapsedMs: number;
    mode: StudyMode;
  }) => Promise<void>;
  resetProgress: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [resolveImage, setResolveImage] = useState<(src: string) => string>(() => (s: string) => s);
  const [cards, setCards] = useState<Map<string, CardProgress>>(new Map());
  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [days, setDays] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Boot.
  useEffect(() => {
    (async () => {
      const s = loadSettings();
      setSettings(s);
      applyTheme(s.theme);
      configureSrs(s.desiredRetention);
      const [c, r, d] = await Promise.all([getAllCards(), getAllReviews(), getAllDays()]);
      setCards(new Map(c.map((x) => [x.id, x])));
      setReviews(r);
      setDays(d);
      try {
        const loaded = await loadBank(s);
        setBank(loaded.bank);
        setResolveImage(() => loaded.resolveImage);
        setFromCache(loaded.fromCache);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the question bank.");
      }
      setLoading(false);
      setReady(true);
    })();
  }, []);

  async function reloadBank() {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadBank(settings);
      setBank(loaded.bank);
      setResolveImage(() => loaded.resolveImage);
      setFromCache(loaded.fromCache);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the question bank.");
    }
    setLoading(false);
  }

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      if (patch.theme !== undefined) applyTheme(next.theme);
      if (patch.desiredRetention !== undefined) configureSrs(next.desiredRetention);
      return next;
    });
  }

  async function recordAnswer({
    question,
    grade,
    correct,
    elapsedMs,
    mode,
  }: {
    question: Question;
    grade: Grade;
    correct: boolean;
    elapsedMs: number;
    mode: StudyMode;
  }) {
    const prev = cards.get(question.id) ?? newCard(question.id);
    const wasNew = prev.state === "new";
    const updated = srsGrade(prev, grade);
    await putCard(updated);

    const log: ReviewLog = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      cardId: question.id,
      topic: question.topic,
      ts: Date.now(),
      grade,
      correct,
      elapsedMs,
      mode,
      prevState: prev.state,
    };
    await addReview(log);
    const day = await bumpDay({
      date: todayKey(),
      reviews: 1,
      correct: correct ? 1 : 0,
      newCards: wasNew ? 1 : 0,
      studyMs: elapsedMs,
    });

    setCards((m) => new Map(m).set(question.id, updated));
    setReviews((rs) => [...rs, log]);
    setDays((ds) => {
      const rest = ds.filter((d) => d.date !== day.date);
      return [...rest, day];
    });
  }

  async function resetProgress() {
    await dbReset();
    setCards(new Map());
    setReviews([]);
    setDays([]);
  }

  const value = useMemo<AppState>(
    () => ({
      ready,
      loading,
      error,
      fromCache,
      bank,
      resolveImage,
      settings,
      cards,
      reviews,
      days,
      reloadBank,
      updateSettings,
      recordAnswer,
      resetProgress,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, loading, error, fromCache, bank, resolveImage, settings, cards, reviews, days],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
