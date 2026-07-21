import { useApp } from "../lib/store";
import type { StudyMode } from "../lib/types";
import { topicMastery } from "../lib/stats";
import { modeCounts } from "../lib/queue";
import { IconChevron, IconTarget } from "../components/icons";

export function Browse({ onStart }: { onStart: (mode: StudyMode, topicId?: string | null) => void }) {
  const { bank, cards, reviews } = useApp();
  if (!bank) return null;

  const topics = topicMastery(bank, cards, reviews).sort(
    (a, b) =>
      (bank.topics.find((t) => t.id === a.id)?.order ?? 99) -
      (bank.topics.find((t) => t.id === b.id)?.order ?? 99),
  );
  const counts = modeCounts(bank, cards);

  return (
    <div className="screen">
      <h1 className="large-title">Browse</h1>
      <p className="subtitle">
        {bank.questions.length} questions · {bank.topics.length} topics
      </p>

      <button className="btn btn--primary btn--block btn--lg" onClick={() => onStart("drill", null)}>
        <IconTarget size={18} /> Drill all topics ({counts.total})
      </button>

      <div className="section-label">Topics</div>
      <div className="stack">
        {topics.map((t) => (
          <button key={t.id} className="list-item" onClick={() => onStart("drill", t.id)}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                background: t.color || "var(--accent)",
                flexShrink: 0,
              }}
            />
            <div className="list-item__body">
              <div className="list-item__title">{t.name}</div>
              <div className="list-item__meta">
                {t.total} question{t.total === 1 ? "" : "s"} · {t.introduced} seen · {Math.round(t.mastery * 100)}% mastery
              </div>
            </div>
            <IconChevron className="list-item__chev" size={20} />
          </button>
        ))}
      </div>
    </div>
  );
}
