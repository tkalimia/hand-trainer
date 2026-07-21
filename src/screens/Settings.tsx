import { useState } from "react";
import { useApp } from "../lib/store";
import type { ContentSourceKind, ThemePref } from "../lib/types";
import { IconRefresh } from "../components/icons";

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segment">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button className="btn btn--ghost" style={{ padding: "6px 14px" }} onClick={() => set(value - step)}>
        −
      </button>
      <b style={{ minWidth: 34, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</b>
      <button className="btn btn--ghost" style={{ padding: "6px 14px" }} onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
}

export function Settings() {
  const { settings, updateSettings, reloadBank, resetProgress, bank, fromCache, loading, error } = useApp();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    await reloadBank();
    setSyncing(false);
  }

  const sourceOptions: { v: ContentSourceKind; label: string; hint: string }[] = [
    { v: "bundled", label: "Bundled sample", hint: "The sample bank shipped with the app." },
    { v: "dropbox-link", label: "Dropbox link", hint: "A public shared ?dl=1 link to questions.json." },
    { v: "dropbox-app", label: "Dropbox app folder", hint: "Private access token — drop files in the app folder." },
    { v: "nas", label: "NAS (Tailscale)", hint: "A folder served from your NAS, e.g. https://kalimian.tail953b96.ts.net/bank/" },
  ];

  return (
    <div className="screen">
      <h1 className="large-title">Settings</h1>
      <p className="subtitle">
        {bank ? `${bank.title ?? "Question bank"} · v${bank.version} · ${bank.questions.length} questions` : "Loading…"}
        {fromCache ? " · offline copy" : ""}
      </p>

      {error && <div className="banner banner--warn">{error}</div>}

      <div className="section-label">Appearance</div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">Theme</div>
          <div className="setting__desc">Match iOS, or lock light / dark.</div>
        </div>
        <Segment<ThemePref>
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { v: "system", label: "Auto" },
            { v: "light", label: "Light" },
            { v: "dark", label: "Dark" },
          ]}
        />
      </div>

      <div className="section-label">Question bank source</div>
      <div className="stack">
        {sourceOptions.map((o) => (
          <button
            key={o.v}
            className="list-item"
            style={settings.source === o.v ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}
            onClick={() => updateSettings({ source: o.v })}
          >
            <div className="list-item__body">
              <div className="list-item__title">{o.label}</div>
              <div className="list-item__meta">{o.hint}</div>
            </div>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid " + (settings.source === o.v ? "var(--accent)" : "var(--border-strong)"),
                background: settings.source === o.v ? "var(--accent)" : "transparent",
                flexShrink: 0,
              }}
            />
          </button>
        ))}
      </div>

      {settings.source === "dropbox-link" && (
        <input
          className="field"
          style={{ marginTop: "var(--space-3)" }}
          placeholder="https://www.dropbox.com/…/questions.json?dl=1"
          value={settings.dropboxLink ?? ""}
          onChange={(e) => updateSettings({ dropboxLink: e.target.value })}
        />
      )}
      {settings.source === "dropbox-app" && (
        <input
          className="field"
          style={{ marginTop: "var(--space-3)" }}
          placeholder="Dropbox access token"
          value={settings.dropboxToken ?? ""}
          onChange={(e) => updateSettings({ dropboxToken: e.target.value })}
        />
      )}
      {settings.source === "nas" && (
        <input
          className="field"
          style={{ marginTop: "var(--space-3)" }}
          placeholder="https://kalimian.tail953b96.ts.net/bank/"
          value={settings.nasUrl ?? ""}
          onChange={(e) => updateSettings({ nasUrl: e.target.value })}
        />
      )}

      <button className="btn btn--primary btn--block" style={{ marginTop: "var(--space-3)" }} onClick={sync} disabled={syncing || loading}>
        <IconRefresh size={18} /> {syncing || loading ? "Syncing…" : "Sync question bank now"}
      </button>

      <div className="section-label">Daily plan</div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">New cards / day</div>
          <div className="setting__desc">How many fresh questions to introduce.</div>
        </div>
        <Stepper value={settings.dailyNewGoal} min={0} max={100} step={5} onChange={(v) => updateSettings({ dailyNewGoal: v })} />
      </div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">Reviews / day</div>
          <div className="setting__desc">Target for due-card reviews.</div>
        </div>
        <Stepper value={settings.dailyReviewGoal} min={0} max={400} step={10} onChange={(v) => updateSettings({ dailyReviewGoal: v })} />
      </div>

      <div className="section-label">Study</div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">Quick session size</div>
          <div className="setting__desc">Cards in a 1-minute burst.</div>
        </div>
        <Stepper value={settings.quickBatch} min={3} max={20} onChange={(v) => updateSettings({ quickBatch: v })} />
      </div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">Exam length</div>
          <div className="setting__desc">Questions per exam simulation.</div>
        </div>
        <Stepper value={settings.examCount} min={5} max={100} step={5} onChange={(v) => updateSettings({ examCount: v })} />
      </div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">Target retention</div>
          <div className="setting__desc">Higher = more frequent reviews (FSRS).</div>
        </div>
        <Segment<string>
          value={String(settings.desiredRetention)}
          onChange={(v) => updateSettings({ desiredRetention: parseFloat(v) })}
          options={[
            { v: "0.8", label: "80%" },
            { v: "0.85", label: "85%" },
            { v: "0.9", label: "90%" },
            { v: "0.95", label: "95%" },
          ]}
        />
      </div>

      <div className="section-label">Reminders</div>
      <div className="setting">
        <div className="setting__body">
          <div className="setting__title">Daily study reminder</div>
          <div className="setting__desc">Web-push nudge when cards are due (needs enabling in the installed app).</div>
        </div>
        <button
          className={"toggle" + (settings.remindersEnabled ? " on" : "")}
          onClick={() => updateSettings({ remindersEnabled: !settings.remindersEnabled })}
          aria-pressed={settings.remindersEnabled}
        >
          <span className="toggle__dot" />
        </button>
      </div>

      <div className="section-label">Data</div>
      <button
        className="btn btn--block"
        style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        onClick={() => {
          if (confirm("Reset all learning progress? Your question bank is untouched, but review history, schedules and stats will be erased.")) {
            resetProgress();
          }
        }}
      >
        Reset learning progress
      </button>

      <p className="muted" style={{ fontSize: "var(--text-xs)", textAlign: "center", marginTop: "var(--space-8)" }}>
        Hand Surgery Trainer · installed as a home-screen app.<br />
        Add to Home Screen from Safari's Share menu for full-screen, offline use.
      </p>
    </div>
  );
}
