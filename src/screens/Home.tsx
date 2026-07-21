import { useApp } from "../lib/store";
import type { SessionSnapshot, StudyMode } from "../lib/types";
import { modeCounts } from "../lib/queue";
import { summarize } from "../lib/stats";
import { Ring } from "../components/charts";
import {
  IconBolt,
  IconRefresh,
  IconBook,
  IconTarget,
  IconClipboard,
  IconFlame,
  IconPlay,
} from "../components/icons";

const MODE_LABEL: Record<StudyMode, string> = {
  quick: "Quick",
  review: "Review",
  learn: "Learn",
  drill: "Topic drill",
  exam: "Exam",
  weak: "Weak spots",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Home({
  resume,
  onResume,
  onStart,
}: {
  resume: SessionSnapshot | null;
  onResume: () => void;
  onStart: (mode: StudyMode, topicId?: string | null) => void;
}) {
  const { bank, cards, reviews, days, settings } = useApp();
  if (!bank) return null;

  const counts = modeCounts(bank, cards);
  const sum = summarize(bank, cards, reviews, days);
  const goalTotal = settings.dailyNewGoal + settings.dailyReviewGoal;
  const goalProgress = Math.min(1, sum.reviewsToday / Math.max(1, goalTotal));

  const tiles: {
    mode: StudyMode;
    Icon: typeof IconBolt;
    desc: string;
    badge?: number;
    disabled?: boolean;
    topicId?: string | null;
  }[] = [
    { mode: "quick", Icon: IconBolt, desc: "A 1-minute burst", badge: counts.due || undefined },
    { mode: "review", Icon: IconRefresh, desc: "Everything due now", badge: counts.due || undefined, disabled: counts.due === 0 },
    { mode: "learn", Icon: IconBook, desc: "Study new material", badge: counts.fresh || undefined, disabled: counts.fresh === 0 },
    { mode: "drill", Icon: IconTarget, desc: "Mixed practice", topicId: null },
    { mode: "exam", Icon: IconClipboard, desc: `${settings.examCount} Q · timed` },
    { mode: "weak", Icon: IconFlame, desc: "Your soft spots", disabled: counts.introduced === 0 },
  ];

  const primaryMode: StudyMode = counts.due > 0 ? "review" : counts.fresh > 0 ? "learn" : "drill";

  return (
    <div className="screen">
      <p className="eyebrow">{greeting()}</p>
      <h1 className="large-title">Hand Surgery</h1>
      <p className="subtitle">Learn in the dead space of your day.</p>

      {resume ? (
        <button className="hero-cta" onClick={onResume}>
          <div className="hero-cta__label">Pick up where you left off</div>
          <div className="hero-cta__title">{MODE_LABEL[resume.mode]} in progress</div>
          <div className="hero-cta__meta">
            Question {resume.index + 1} of {resume.queue.length} · {resume.answered} answered
          </div>
          <span className="hero-cta__resume">
            <IconPlay size={15} /> Resume
          </span>
        </button>
      ) : (
        <button className="hero-cta" onClick={() => onStart(primaryMode)}>
          <div className="hero-cta__label">Today</div>
          <div className="hero-cta__title">
            {counts.due > 0 ? `${counts.due} cards due` : counts.fresh > 0 ? "Start learning" : "Practice a set"}
          </div>
          <div className="hero-cta__meta">
            {counts.due > 0
              ? "Tap to start your review session"
              : counts.fresh > 0
                ? `${counts.fresh} new cards ready to learn`
                : "You're all caught up — drill to stay sharp"}
          </div>
          <span className="hero-cta__resume">
            <IconPlay size={15} /> {MODE_LABEL[primaryMode]}
          </span>
        </button>
      )}

      <div className="stat-row" style={{ marginTop: "var(--space-5)" }}>
        <div className="stat-tile">
          <div className="stat-tile__num accent">{counts.due}</div>
          <div className="stat-tile__label">Due now</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__num">{counts.fresh}</div>
          <div className="stat-tile__label">New</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__num">{sum.streak}🔥</div>
          <div className="stat-tile__label">Day streak</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
        <Ring
          size={92}
          stroke={9}
          progress={goalProgress}
          label={`${sum.reviewsToday}`}
          sub={`/ ${goalTotal}`}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>Today's goal</div>
          <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>
            {goalProgress >= 1
              ? "Goal reached — great work."
              : `${Math.max(0, goalTotal - sum.reviewsToday)} more to hit your daily target.`}
          </div>
        </div>
      </div>

      <div className="section-label">Learning modes</div>
      <div className="mode-grid">
        {tiles.map((t) => (
          <button
            key={t.mode}
            className="mode-tile"
            disabled={t.disabled}
            style={t.disabled ? { opacity: 0.5 } : undefined}
            onClick={() => onStart(t.mode, t.topicId)}
          >
            <t.Icon className="mode-tile__icon" />
            <div className="mode-tile__title">{MODE_LABEL[t.mode]}</div>
            <div className="mode-tile__desc">{t.desc}</div>
            {t.badge ? <span className="mode-tile__badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
