// ── Content model (authored in questions.json on Dropbox) ────────────────
export type QuestionType = "mcq" | "multi" | "read";
export type Difficulty = "easy" | "medium" | "hard";

export interface QImage {
  src: string; // path relative to the bank, e.g. "images/zones.png"
  caption?: string;
  alt?: string;
}

export interface QOption {
  text: string;
  correct: boolean;
}

export interface Question {
  id: string;
  topic: string; // topic id
  type: QuestionType;
  difficulty?: Difficulty;
  stem: string; // markdown
  images?: QImage[];
  options?: QOption[]; // required for mcq / multi
  explanation?: string; // markdown, shown after answering
  references?: string[];
  tags?: string[];
}

export interface Topic {
  id: string;
  name: string;
  order?: number;
  color?: string;
}

export interface QuestionBank {
  version: number;
  updatedAt: string;
  title?: string;
  topics: Topic[];
  questions: Question[];
}

// ── Learner state (stored locally in IndexedDB) ──────────────────────────
// Mirrors an FSRS card. Kept plain-serializable.
export type CardState = "new" | "learning" | "review" | "relearning";

export interface CardProgress {
  id: string; // == question id
  due: number; // epoch ms when next due
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: number | null; // epoch ms
  introduced: number | null; // first-seen epoch ms
}

export type Grade = 1 | 2 | 3 | 4; // Again / Hard / Good / Easy

export interface ReviewLog {
  id: string; // review log id
  cardId: string;
  topic: string;
  ts: number; // epoch ms
  grade: Grade;
  correct: boolean; // for mcq: whether selection matched
  elapsedMs: number; // time spent on the question
  mode: StudyMode;
  prevState: CardState;
}

// ── Study session / resume ───────────────────────────────────────────────
export type StudyMode =
  | "quick"
  | "review"
  | "learn"
  | "drill"
  | "exam"
  | "weak";

export interface SessionSnapshot {
  mode: StudyMode;
  topicId: string | null; // for drill
  queue: string[]; // ordered question ids
  index: number; // current position in queue
  // Per-question live state so we resume mid-question:
  selected: number[]; // indices chosen but not necessarily submitted
  revealed: boolean; // answer revealed?
  startedAt: number; // session start epoch ms
  questionStartedAt: number; // current-question start epoch ms
  elapsedBeforeHidden: number; // accumulated ms on current question before last hide
  scrollTop: number;
  answered: number; // count answered this session
  correctCount: number;
  savedAt: number;
}

// ── Settings & plan ──────────────────────────────────────────────────────
export type ThemePref = "system" | "light" | "dark";
export type ContentSourceKind = "bundled" | "dropbox-link" | "dropbox-app" | "nas";

export interface Settings {
  theme: ThemePref;
  dailyNewGoal: number;
  dailyReviewGoal: number;
  quickBatch: number; // cards per Quick session
  examCount: number; // questions per exam
  desiredRetention: number; // FSRS target (0-1)
  remindersEnabled: boolean;
  source: ContentSourceKind;
  dropboxLink?: string; // shared ?dl=1 link to questions.json
  dropboxToken?: string; // app-folder access token
  nasUrl?: string; // e.g. https://kalimian.tail953b96.ts.net/bank/
}

export interface DayActivity {
  date: string; // YYYY-MM-DD (local)
  reviews: number;
  correct: number;
  newCards: number;
  studyMs: number;
}
