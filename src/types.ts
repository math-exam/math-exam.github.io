export interface Domain {
  name: string;
  color: string;
  study: string;
}
export type Domains = Record<string, Domain>;

export interface Question {
  id: string;
  dom: string;
  diff: number;
  q: string;
  opts: string[];
  correct: number;
  why: string;
  tip: string;
  img?: string;
  tag?: string;
  addedAt?: string;
  module?: string;
  lesson?: string;
  source?: string;
}

export interface Bank {
  domains: Domains;
  questions: Question[];
}

export interface PaperCriteria {
  fromDate: string | null;
  toDate: string | null;
  domains: string[];
  minDiff: number;
  maxDiff: number;
  count: number;
  module?: string;
}

export interface Paper {
  id: string;
  title: string;
  createdAt: string;
  criteria?: PaperCriteria;
  questionIds: string[];
}

export interface Focus {
  domains: string[];
  tags: string[];
  note: string;
}

interface AssignmentBase {
  id: string;
  title: string;
  assignedAt: string;
}
export type Assignment =
  | (AssignmentBase & { kind: 'paper'; paperId: string })
  | (AssignmentBase & { kind: 'custom'; paper: Paper })
  | (AssignmentBase & { kind: 'adaptive'; focus: Focus | null; testLength: number });

export interface AssignmentsFile {
  assignments: Assignment[];
}

export interface AppState {
  usedQuestionIds: string[];
  lastActivityAt: string | null;
}

export interface ResponseRecord {
  order: number;
  id: string;
  dom: string;
  domName: string;
  difficultyBefore: number;
  itemDifficulty: number;
  diff: number;
  q: string;
  opts: string[];
  img: string | null;
  chosen: number;
  chosenText: string;
  correct: number;
  correctText: string;
  isCorrect: boolean;
  why: string;
  tip: string;
  time: number;
  difficultyAfter: number;
  adaptiveMove: 'up' | 'down' | 'hold';
}

export interface CurrentQuestion {
  id: string;
  opts: string[];
  correctIndex: number;
  targetAtServe: number;
  servedAt: number;
}

export interface Summary {
  student: string | null;
  startedAt: string;
  finishedAt: string | null;
  correct: number;
  total: number;
  percent: number;
  practiceLevel: number | null;
  averageCorrectLevel: number | null;
  peakLevelReached: number | null;
  totalTimeSeconds: number;
  domainBreakdown: Record<string, { name: string; correct: number; total: number; percent: number }>;
  path: { order: number; itemLevel: number; correct: boolean; dom: string }[];
}

export interface Session {
  id: string;
  name: string;
  assignmentId: string;
  title: string;
  kind: 'paper' | 'adaptive';
  paperQuestionIds: string[] | null;
  focus: Focus | null;
  startedAt: string;
  finishedAt: string | null;
  lastActivityAt: string;
  endedReason: 'ended-in-admin' | 'bank-exhausted' | null;
  difficulty: number;
  testLength: number;
  askedIds: string[];
  current: CurrentQuestion | null;
  responses: ResponseRecord[];
  summary: Summary | null;
}

export interface CurrentFile {
  session: Session | null;
  writerId: string | null;
}

export interface SessionsFile {
  sessions: Session[];
}

export interface QuestionView {
  questionNumber: number;
  testLength: number;
  domain: string;
  domainName: string;
  difficulty: number;
  prompt: string;
  img: string | null;
  options: string[];
}

export interface AnswerResult {
  isCorrect: boolean;
  correctIndex: number;
  correctText: string;
  why: string;
  tip: string;
  finished: boolean;
  next: QuestionView | null;
}

export interface Insight {
  tone: 'good' | 'warn' | 'neutral';
  text: string;
}
