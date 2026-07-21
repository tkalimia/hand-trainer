// Lightweight, dependency-free SVG/HTML charts themed with design tokens.

export function Ring({
  progress,
  size = 128,
  stroke = 11,
  label,
  sub,
}: {
  progress: number; // 0–1
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 600ms var(--ease)" }}
      />
      {label && (
        <text x="50%" y="47%" textAnchor="middle" fontSize={size * 0.26} fontWeight={900} fill="var(--text)">
          {label}
        </text>
      )}
      {sub && (
        <text x="50%" y="63%" textAnchor="middle" fontSize={size * 0.1} fill="var(--text-2)">
          {sub}
        </text>
      )}
    </svg>
  );
}

export function ForecastBars({ data, days = 14 }: { data: { date: string; count: number }[]; days?: number }) {
  const slice = data.slice(0, days);
  const max = Math.max(1, ...slice.map((d) => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
      {slice.map((d, i) => (
        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            title={`${d.date}: ${d.count} due`}
            style={{
              width: "100%",
              height: `${(d.count / max) * 74}px`,
              minHeight: d.count ? 3 : 0,
              background: i === 0 ? "var(--accent)" : "var(--accent-soft)",
              border: i === 0 ? "none" : "1px solid var(--accent)",
              borderRadius: 4,
              transition: "height 400ms var(--ease)",
            }}
          />
          <span style={{ fontSize: 9, color: "var(--text-3)" }}>
            {i === 0 ? "now" : new Date(d.date).getDate()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({
  data,
  height = 70,
}: {
  data: { date: string; accuracy: number; n: number }[];
  height?: number;
}) {
  const w = 300;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = height - d.accuracy * (height - 8) - 4;
    return { x, y, d };
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={height - 4 - 0.9 * (height - 8)} x2={w} y2={height - 4 - 0.9 * (height - 8)} stroke="var(--border)" strokeDasharray="4 4" />
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => p.d.n > 0 && <circle key={p.d.date} cx={p.x} cy={p.y} r="2.6" fill="var(--accent)" />)}
    </svg>
  );
}

export function CalendarHeatmap({ cells }: { cells: { date: string; reviews: number }[] }) {
  const max = Math.max(1, ...cells.map((c) => c.reviews));
  return (
    <div className="cal-grid">
      {cells.map((c) =>
        c.reviews > 0 ? (
          <div
            key={c.date}
            className="cal-cell"
            title={`${c.date}: ${c.reviews} reviews`}
            style={{ background: "var(--accent)", opacity: 0.25 + 0.75 * (c.reviews / max) }}
          />
        ) : (
          <div key={c.date} className="cal-cell" title={`${c.date}: 0`} />
        ),
      )}
    </div>
  );
}

export function TimeOfDayHeatmap({ data }: { data: { hour: number; count: number; accuracy: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="tod-grid">
        {data.map((d) =>
          d.count > 0 ? (
            <div
              key={d.hour}
              className="tod-cell"
              title={`${d.hour}:00 — ${d.count} reviews, ${Math.round(d.accuracy * 100)}%`}
              style={{ background: "var(--accent)", opacity: 0.2 + 0.8 * (d.count / max) }}
            />
          ) : (
            <div key={d.hour} className="tod-cell" title={`${d.hour}:00 — none`} />
          ),
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-3)", marginTop: 4 }}>
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
}

export function MasteryBar({
  name,
  value,
  detail,
  color = "var(--accent)",
}: {
  name: string;
  value: number; // 0–1
  detail?: string;
  color?: string;
}) {
  return (
    <div className="mastery">
      <div className="mastery__head">
        <span className="mastery__name">{name}</span>
        <span className="mastery__pct">{detail ?? `${Math.round(value * 100)}%`}</span>
      </div>
      <div className="mastery__track">
        <div className="mastery__fill" style={{ width: `${Math.max(2, value * 100)}%`, background: color }} />
      </div>
    </div>
  );
}
