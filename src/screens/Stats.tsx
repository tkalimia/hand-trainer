import { useMemo } from "react";
import { useApp } from "../lib/store";
import {
  summarize,
  topicMastery,
  weakTopics,
  forecast,
  calendarMatrix,
  timeOfDay,
  accuracyOverTime,
  velocity,
  fmtDuration,
} from "../lib/stats";
import {
  CalendarHeatmap,
  ForecastBars,
  MasteryBar,
  Sparkline,
  TimeOfDayHeatmap,
} from "../components/charts";
import { IconInbox } from "../components/icons";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Stats() {
  const { bank, cards, reviews, days } = useApp();

  const data = useMemo(() => {
    if (!bank) return null;
    return {
      sum: summarize(bank, cards, reviews, days),
      topics: topicMastery(bank, cards, reviews),
      fc: forecast(cards, 30),
      cal: calendarMatrix(days, 17),
      tod: timeOfDay(reviews),
      acc: accuracyOverTime(reviews, 21),
      vel: velocity(cards, reviews),
    };
  }, [bank, cards, reviews, days]);

  if (!bank || !data) return null;
  const { sum, topics, fc, cal, tod, acc, vel } = data;
  const weak = weakTopics(topics);
  const hasHistory = reviews.length > 0;

  return (
    <div className="screen">
      <h1 className="large-title">Insights</h1>
      <p className="subtitle">How your learning is actually going.</p>

      {!hasHistory && (
        <div className="banner banner--info">
          <IconInbox size={20} />
          <span>Answer a few questions and your statistics will build up here — retention, mastery, forecast and more.</span>
        </div>
      )}

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-tile__num accent">{sum.introduced}<span style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>/{sum.total}</span></div>
          <div className="stat-tile__label">Cards seen</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__num">{sum.mature}</div>
          <div className="stat-tile__label">Mature</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__num">{pct(sum.retentionAvg)}</div>
          <div className="stat-tile__label">Retention</div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: "var(--space-4)" }}>
        <div className="chart-card__title">Accuracy over time</div>
        <div className="chart-card__sub">Share correct per day · dashed line = 90% target</div>
        <Sparkline data={acc} />
      </div>

      <div className="chart-card">
        <div className="chart-card__title">Mastery by topic</div>
        <div className="chart-card__sub">Coverage × predicted retention</div>
        {topics.map((t) => (
          <MasteryBar
            key={t.id}
            name={t.name}
            value={t.mastery}
            detail={`${t.introduced}/${t.total} · ${pct(t.mastery)}`}
            color={t.color || "var(--accent)"}
          />
        ))}
      </div>

      <div className="chart-card">
        <div className="chart-card__title">Review forecast</div>
        <div className="chart-card__sub">Cards coming due over the next 14 days</div>
        <ForecastBars data={fc} days={14} />
      </div>

      <div className="chart-card">
        <div className="chart-card__title">Activity</div>
        <div className="chart-card__sub">Last 17 weeks · reviews per day</div>
        <CalendarHeatmap cells={cal} />
        <div className="legend">
          less
          <span className="legend__swatch" style={{ background: "var(--surface-3)" }} />
          <span className="legend__swatch" style={{ background: "var(--accent)", opacity: 0.4 }} />
          <span className="legend__swatch" style={{ background: "var(--accent)", opacity: 0.7 }} />
          <span className="legend__swatch" style={{ background: "var(--accent)" }} />
          more
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card__title">When you study</div>
        <div className="chart-card__sub">Reviews by hour of day — find your dead-space pattern</div>
        <TimeOfDayHeatmap data={tod} />
      </div>

      <div className="chart-card">
        <div className="chart-card__title">Learning velocity</div>
        <div className="chart-card__sub">Last 7 days</div>
        <div className="stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="stat-tile">
            <div className="stat-tile__num">{vel.learnedThisWeek}</div>
            <div className="stat-tile__label">New learned</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__num">{vel.reviewsThisWeek}</div>
            <div className="stat-tile__label">Reviews</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__num">{vel.avgResponseMs ? fmtDuration(vel.avgResponseMs) : "–"}</div>
            <div className="stat-tile__label">Avg / card</div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__num">{pct(vel.matureShare)}</div>
            <div className="stat-tile__label">Mature share</div>
          </div>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="chart-card">
          <div className="chart-card__title">Focus next</div>
          <div className="chart-card__sub">Lowest mastery among topics you've started</div>
          <div className="list">
            {weak.map((t) => (
              <div className="list-item" key={t.id}>
                <span className="pill" style={{ color: t.color }}>{pct(t.mastery)}</span>
                <div className="list-item__body">
                  <div className="list-item__title">{t.name}</div>
                  <div className="list-item__meta">{pct(t.accuracy)} accuracy · {t.introduced}/{t.total} seen</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
