import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import type { Grade, Question, SessionSnapshot, StudyMode } from "../lib/types";
import { buildQueue } from "../lib/queue";
import { newCard, previewIntervals } from "../lib/srs";
import { clearSession, installSessionAutosave, saveSession } from "../lib/session";
import { Markdown } from "../components/Markdown";
import { Ring } from "../components/charts";
import { IconArrowLeft, IconCheck, IconX } from "../components/icons";

const KEYS = ["A", "B", "C", "D", "E", "F"];
const RATING: { g: Grade; label: string; cls: string }[] = [
  { g: 1, label: "Again", cls: "again" },
  { g: 2, label: "Hard", cls: "hard" },
  { g: 3, label: "Good", cls: "good" },
  { g: 4, label: "Easy", cls: "easy" },
];

export function Study({
  mode,
  topicId,
  initial,
  onExit,
}: {
  mode: StudyMode;
  topicId: string | null;
  initial: SessionSnapshot | null;
  onExit: () => void;
}) {
  const { bank, cards, resolveImage, recordAnswer, settings } = useApp();

  const byId = useMemo(() => new Map((bank?.questions ?? []).map((q) => [q.id, q])), [bank]);

  const [queue] = useState<string[]>(() =>
    initial ? initial.queue : buildQueue(mode, bank!, cards, settings, topicId),
  );
  const [index, setIndex] = useState(initial?.index ?? 0);
  const [selected, setSelected] = useState<number[]>(initial?.selected ?? []);
  const [revealed, setRevealed] = useState(initial?.revealed ?? false);
  const [answered, setAnswered] = useState(initial?.answered ?? 0);
  const [correctCount, setCorrectCount] = useState(initial?.correctCount ?? 0);
  const [done, setDone] = useState(false);

  const startedAt = useRef(initial?.startedAt ?? Date.now());
  const questionStartedAt = useRef(Date.now());
  const elapsedBeforeHidden = useRef(initial?.elapsedBeforeHidden ?? 0);
  const qcardRef = useRef<HTMLDivElement>(null);
  const examResults = useRef<{ id: string; correct: boolean }[]>([]);

  const isExam = mode === "exam";
  const q: Question | undefined = byId.get(queue[index]);
  const progress = queue.length ? index / queue.length : 0;

  const elapsedNow = useCallback(
    () => elapsedBeforeHidden.current + (Date.now() - questionStartedAt.current),
    [],
  );

  const snapshot = useCallback(
    (): SessionSnapshot => ({
      mode,
      topicId,
      queue,
      index,
      selected,
      revealed,
      startedAt: startedAt.current,
      questionStartedAt: Date.now(),
      elapsedBeforeHidden: elapsedNow(),
      scrollTop: qcardRef.current?.scrollTop ?? 0,
      answered,
      correctCount,
      savedAt: Date.now(),
    }),
    [mode, topicId, queue, index, selected, revealed, answered, correctCount, elapsedNow],
  );

  // Autosave the live snapshot whenever the app is hidden/frozen…
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  useEffect(() => installSessionAutosave(() => (done ? null : snapRef.current())), [done]);

  // …and after every state change, so a hard kill still resumes precisely.
  useEffect(() => {
    if (!done && queue.length) saveSession(snapshot());
  }, [index, selected, revealed, done, queue.length, snapshot]);

  // Restore scroll position on (re)mount for the current question.
  useEffect(() => {
    if (initial && qcardRef.current) qcardRef.current.scrollTop = initial.scrollTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bank || !queue.length) {
    return (
      <div className="study">
        <div className="empty" style={{ margin: "auto" }}>
          <p className="large-title" style={{ fontSize: "var(--text-xl)" }}>Nothing to study</p>
          <p className="muted" style={{ marginTop: 8 }}>
            No cards are queued for this mode right now.
          </p>
          <button className="btn btn--primary" style={{ marginTop: 24 }} onClick={onExit}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const card = cards.get(q!.id) ?? newCard(q!.id);
  const intervals = previewIntervals(card);

  const correctIdx = (q!.options ?? []).map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
  const isCorrect = () => {
    if (q!.type === "read") return true;
    if (q!.type === "multi") {
      const a = [...selected].sort().join(",");
      const b = [...correctIdx].sort().join(",");
      return a === b && selected.length > 0;
    }
    return selected.length === 1 && q!.options?.[selected[0]]?.correct === true;
  };

  function toggle(i: number) {
    if (revealed) return;
    if (q!.type === "multi") {
      setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    } else {
      setSelected([i]);
    }
  }

  function advance() {
    setSelected([]);
    setRevealed(false);
    elapsedBeforeHidden.current = 0;
    questionStartedAt.current = Date.now();
    if (index + 1 >= queue.length) {
      finish();
    } else {
      setIndex((i) => i + 1);
      requestAnimationFrame(() => qcardRef.current && (qcardRef.current.scrollTop = 0));
    }
  }

  function finish() {
    clearSession();
    setDone(true);
  }

  async function commit(g: Grade) {
    const correct = isCorrect();
    await recordAnswer({ question: q!, grade: g, correct, elapsedMs: elapsedNow(), mode });
    setAnswered((a) => a + 1);
    if (correct) setCorrectCount((c) => c + 1);
    advance();
  }

  // Non-exam MCQ: reveal answer + explanation before rating.
  function check() {
    setRevealed(true);
  }

  // Exam: record silently (grade from correctness) and move on.
  async function examNext() {
    const correct = isCorrect();
    examResults.current.push({ id: q!.id, correct });
    await recordAnswer({ question: q!, grade: correct ? 3 : 1, correct, elapsedMs: elapsedNow(), mode });
    setAnswered((a) => a + 1);
    if (correct) setCorrectCount((c) => c + 1);
    advance();
  }

  if (done) {
    return (
      <SessionComplete
        answered={answered}
        correct={correctCount}
        isExam={isExam}
        onExit={onExit}
      />
    );
  }

  const optionState = (i: number) => {
    if (!revealed || isExam) return selected.includes(i) ? "selected" : "";
    if (q!.options?.[i]?.correct) return "correct";
    if (selected.includes(i)) return "wrong";
    return "";
  };

  const topic = bank.topics.find((t) => t.id === q!.topic);

  return (
    <div className="study">
      <div className="study__top">
        <button className="study__close" onClick={() => { clearSession(); onExit(); }} aria-label="Close">
          <IconX size={18} />
        </button>
        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="study__count">
          {index + 1} / {queue.length}
        </span>
      </div>

      <div className="qcard" ref={qcardRef}>
        <span className="qcard__topic">{topic?.name ?? q!.topic}</span>

        <div className="qcard__stem">
          <Markdown>{q!.stem}</Markdown>
        </div>

        {(q!.images ?? []).map((img, i) => (
          <figure className="qcard__img" key={i}>
            <img src={resolveImage(img.src)} alt={img.alt ?? img.caption ?? ""} loading="lazy" />
            {img.caption && <figcaption>{img.caption}</figcaption>}
          </figure>
        ))}

        {q!.type !== "read" && (
          <div className="options">
            {(q!.options ?? []).map((o, i) => (
              <button
                key={i}
                className={"option " + optionState(i)}
                disabled={revealed && !isExam}
                onClick={() => toggle(i)}
              >
                <span className="option__key">
                  {revealed && !isExam && o.correct ? <IconCheck size={16} /> : KEYS[i]}
                </span>
                <span>{o.text}</span>
              </button>
            ))}
          </div>
        )}

        {revealed && !isExam && q!.explanation && (
          <div className="explain">
            <div className={"explain__verdict " + (isCorrect() ? "ok" : "no")}>
              {isCorrect() ? <IconCheck size={20} /> : <IconX size={20} />}
              {isCorrect() ? "Correct" : "Not quite"}
            </div>
            <Markdown>{q!.explanation}</Markdown>
            {q!.references && q!.references.length > 0 && (
              <div className="explain__refs">{q!.references.join(" · ")}</div>
            )}
          </div>
        )}

        {q!.type === "read" && (
          <div className="explain" style={{ background: "transparent", border: "none", paddingLeft: 0, paddingRight: 0 }}>
            {q!.references && q!.references.length > 0 && (
              <div className="explain__refs">{q!.references.join(" · ")}</div>
            )}
          </div>
        )}
      </div>

      <div className="study__footer">
        {q!.type === "read" ? (
          <div className="rating">
            <button className="rating__btn again" onClick={() => commit(1)}>
              <b>Again</b>
              <small>{intervals[1]}</small>
            </button>
            <button className="rating__btn good" onClick={() => commit(3)}>
              <b>Got it</b>
              <small>{intervals[3]}</small>
            </button>
            <button className="rating__btn easy" onClick={() => commit(4)}>
              <b>Easy</b>
              <small>{intervals[4]}</small>
            </button>
          </div>
        ) : isExam ? (
          <button className="btn btn--primary btn--block btn--lg" disabled={!selected.length} onClick={examNext}>
            {index + 1 >= queue.length ? "Finish exam" : "Next"}
          </button>
        ) : !revealed ? (
          <button className="btn btn--primary btn--block btn--lg" disabled={!selected.length} onClick={check}>
            Check answer
          </button>
        ) : (
          <>
            <div className="rating__hint">How well did you recall it?</div>
            <div className="rating">
              {RATING.map((r) => (
                <button key={r.g} className={"rating__btn " + r.cls} onClick={() => commit(r.g)}>
                  <b>{r.label}</b>
                  <small>{intervals[r.g]}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SessionComplete({
  answered,
  correct,
  isExam,
  onExit,
}: {
  answered: number;
  correct: number;
  isExam: boolean;
  onExit: () => void;
}) {
  const pct = answered ? correct / answered : 0;
  return (
    <div className="study">
      <div className="done">
        <div className="done__ring">
          <Ring progress={isExam ? pct : 1} label={isExam ? `${Math.round(pct * 100)}%` : String(answered)} sub={isExam ? "score" : "reviewed"} />
        </div>
        <h2 className="done__title">{isExam ? "Exam complete" : "Session complete"}</h2>
        <p className="done__sub">
          {isExam
            ? `You answered ${correct} of ${answered} correctly.`
            : `${answered} card${answered === 1 ? "" : "s"} reviewed · ${Math.round(pct * 100)}% correct. Nicely done.`}
        </p>
        <button className="btn btn--primary btn--block btn--lg" onClick={onExit}>
          <IconArrowLeft size={18} /> Back to home
        </button>
      </div>
    </div>
  );
}
