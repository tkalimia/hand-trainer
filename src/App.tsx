import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./lib/store";
import { TabBar, type Tab } from "./components/TabBar";
import { Home } from "./screens/Home";
import { Stats } from "./screens/Stats";
import { Plan } from "./screens/Plan";
import { Browse } from "./screens/Browse";
import { Settings } from "./screens/Settings";
import { Study } from "./screens/Study";
import { clearSession, loadSession } from "./lib/session";
import type { SessionSnapshot, StudyMode } from "./lib/types";

interface StudyReq {
  mode: StudyMode;
  topicId: string | null;
  initial: SessionSnapshot | null;
}

function Shell() {
  const { ready, error, bank } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [study, setStudy] = useState<StudyReq | null>(null);
  const [resume, setResume] = useState<SessionSnapshot | null>(null);

  useEffect(() => {
    if (ready) setResume(loadSession());
  }, [ready]);

  function start(mode: StudyMode, topicId: string | null = null) {
    clearSession();
    setResume(null);
    setStudy({ mode, topicId, initial: null });
  }
  function doResume() {
    if (resume) setStudy({ mode: resume.mode, topicId: resume.topicId, initial: resume });
  }
  function exitStudy() {
    setStudy(null);
    setResume(loadSession());
    setTab("home");
  }

  if (!ready) {
    return (
      <div className="app">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !bank) {
    return (
      <div className="app">
        <div className="empty" style={{ margin: "auto" }}>
          <p className="large-title" style={{ fontSize: "var(--text-xl)" }}>Can't load questions</p>
          <p className="muted" style={{ marginTop: 8 }}>{error}</p>
          <p className="muted" style={{ marginTop: 8, fontSize: "var(--text-sm)" }}>
            Check your source in Settings, or connect to the internet and reopen.
          </p>
        </div>
      </div>
    );
  }

  if (study) {
    return (
      <div className="app">
        <Study mode={study.mode} topicId={study.topicId} initial={study.initial} onExit={exitStudy} />
      </div>
    );
  }

  return (
    <div className="app">
      {tab === "home" && <Home resume={resume} onResume={doResume} onStart={start} />}
      {tab === "stats" && <Stats />}
      {tab === "plan" && <Plan onStart={start} />}
      {tab === "browse" && <Browse onStart={start} />}
      {tab === "settings" && <Settings />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
