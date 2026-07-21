import { useMemo } from "react";
import { useApp } from "../lib/store";
import type { StudyMode } from "../lib/types";
import { summarize, topicMastery } from "../lib/stats";
import { retrievability } from "../lib/srs";
import { MasteryBar } from "../components/charts";
import { IconChevron, IconFlame, IconClock } from "../components/icons";

export function Plan({ onStart }: { onStart: (mode: StudyMode, topicId?: string | null) => void }) {
  const { bank, cards, reviews, days, settings } = useApp();

  const data = useMemo(() => {
    if (!bank) return null;
    const sum = summarize(bank, cards, reviews, days);
    // "Well-known" = predicted retrievability ≥ desired retention.
    let known = 0;
    for (const q of bank.questions) {
      const c = cards.get(q.id);
      if (c && c.state !== "new" && retrievability(c) >= settings.desiredRetention) known++;
    }
    const remaining = bank.questions.length - known;
    const perDay = Math.max(1, settings.dailyNewGoal);
    const daysToReady = Math.ceil(remaining / perDay);
    return { sum, topics: topicMastery(bank, cards, reviews), known, remaining, daysToReady };
  }, [bank, cards, reviews, days, settings]);

  if (!bank || !data) return null;
  const { sum, topics, known, daysToReady } = data;

  const newDone = days.find((d) => d.date === todayKeyLocal())?.newCards ?? 0;
  const reviewDone = sum.reviewsToday;
  const newPct = Math.min(1, newDone / Math.max(1, settings.dailyNewGoal));
  const reviewPct = Math.min(1, reviewDone / Math.max(1, settings.dailyReviewGoal));

  return (
    <div className="screen">
      <h1 className="large-title">Plan</h1>
      <p className="subtitle">Small daily targets, steady progress.</p>

      <div className="card">
        <div className="row-between" style={{ marginBottom: "var(--space-4)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>Today's targets</div>
            <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Adjust these in Settings.</div>
          </div>
          <span className="pill">
            <IconFlame size={14} /> {sum.streak} day streak
          </span>
        </div>
        <MasteryBar name="New cards" value={newPct} detail={`${newDone}/${settings.dailyNewGoal}`} color="var(--warm)" />
        <MasteryBar name="Reviews" value={reviewPct} detail={`${reviewDone}/${settings.dailyReviewGoal}`} color="var(--accent)" />
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => onStart(sum.dueNow > 0 ? "review" : "learn")}>
            {sum.dueNow > 0 ? "Do reviews" : "Learn new"}
          </button>
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => onStart("quick")}>
            Quick 1 min
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <IconClock size={30} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700 }}>Exam-ready estimate</div>
          <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>
            {known} of {bank.questions.length} well-retained. At {settings.dailyNewGoal} new/day you'd cover the rest in{" "}
            <b style={{ color: "var(--text)" }}>~{daysToReady} day{daysToReady === 1 ? "" : "s"}</b>.
          </div>
        </div>
      </div>

      <div className="section-label">Curriculum path</div>
      <div className="stack">
        {topics
          .slice()
          .sort((a, b) => (bank.topics.find((t) => t.id === a.id)?.order ?? 99) - (bank.topics.find((t) => t.id === b.id)?.order ?? 99))
          .map((t) => (
            <button key={t.id} className="list-item" onClick={() => onStart(t.introduced < t.total ? "learn" : "drill", t.id)}>
              <div className="list-item__body">
                <div className="list-item__title">{t.name}</div>
                <div style={{ marginTop: 8 }}>
                  <div className="mastery__track">
                    <div className="mastery__fill" style={{ width: `${Math.max(3, t.mastery * 100)}%`, background: t.color || "var(--accent)" }} />
                  </div>
                </div>
                <div className="list-item__meta" style={{ marginTop: 6 }}>
                  {t.introduced}/{t.total} seen · {Math.round(t.mastery * 100)}% mastery
                </div>
              </div>
              <IconChevron className="list-item__chev" size={20} />
            </button>
          ))}
      </div>
    </div>
  );
}

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
