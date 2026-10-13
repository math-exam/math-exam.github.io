import { IDLE_MS, START_DIFF } from './config';
import type {
  AnswerResult,
  Assignment,
  Bank,
  Domains,
  Insight,
  Paper,
  PaperCriteria,
  Question,
  QuestionView,
  ResponseRecord,
  Session,
  Summary
} from './types';

export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
}

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export class Engine {
  readonly domains: Domains;
  readonly questions: Question[];
  readonly byId: Map<string, Question>;

  constructor(bank: Bank) {
    this.domains = bank.domains;
    this.questions = bank.questions;
    this.byId = new Map(bank.questions.map(q => [q.id, q]));
  }

  domainName(dom: string): string {
    return this.domains[dom]?.name ?? dom;
  }

  startSession(name: string, assignment: Assignment, papers: Map<string, Paper>, used: Set<string>): Session {
    const now = new Date().toISOString();
    let paperQuestionIds: string[] | null = null;
    if (assignment.kind === 'paper' || assignment.kind === 'custom') {
      const paper = assignment.kind === 'paper' ? papers.get(assignment.paperId) : assignment.paper;
      if (!paper) throw new Error(`Paper "${assignment.title}" is no longer available.`);
      paperQuestionIds = paper.questionIds.filter(id => this.byId.has(id));
      if (!paperQuestionIds.length) throw new Error(`Paper "${assignment.title}" has no questions.`);
    }
    const s: Session = {
      id: newId(),
      name,
      assignmentId: assignment.id,
      title: assignment.title,
      kind: paperQuestionIds ? 'paper' : 'adaptive',
      paperQuestionIds,
      focus: assignment.kind === 'adaptive' ? assignment.focus : null,
      startedAt: now,
      finishedAt: null,
      lastActivityAt: now,
      endedReason: null,
      difficulty: START_DIFF,
      testLength: paperQuestionIds
        ? paperQuestionIds.length
        : assignment.kind === 'adaptive'
          ? assignment.testLength
          : 0,
      askedIds: [],
      current: null,
      responses: [],
      summary: null
    };

    let first: Question;
    if (paperQuestionIds) {
      first = this.byId.get(paperQuestionIds[0])!;
    } else {
      let pool = this.questions.filter(q => q.diff === START_DIFF && !used.has(q.id));
      if (!pool.length) pool = this.questions.filter(q => q.diff === START_DIFF);
      const focus = s.focus;
      if (focus) {
        const focused = pool.filter(q => focus.domains.includes(q.dom) || (q.tag && focus.tags.includes(q.tag)));
        if (focused.length) pool = focused;
      }
      first = pool[Math.floor(Math.random() * pool.length)];
    }
    this.serveQuestion(s, first, used);
    return s;
  }

  private serveQuestion(s: Session, q: Question, used: Set<string>): void {
    s.askedIds.push(q.id);
    if (s.kind === 'adaptive') used.add(q.id);
    const order = shuffle([0, 1, 2, 3]);
    s.current = {
      id: q.id,
      opts: order.map(i => q.opts[i]),
      correctIndex: order.indexOf(q.correct),
      targetAtServe: s.difficulty,
      servedAt: Date.now()
    };
  }

  private pickNext(s: Session, used: Set<string>): Question | null {
    if (s.paperQuestionIds) {
      const id = s.paperQuestionIds[s.responses.length];
      return id ? (this.byId.get(id) ?? null) : null;
    }
    const asked = new Set(s.askedIds);
    const pool = this.questions.filter(q => !asked.has(q.id) && !used.has(q.id));
    const source = pool.length ? pool : this.questions.filter(q => !asked.has(q.id));
    if (!source.length) return null;
    const domCount: Record<string, number> = {};
    s.responses.forEach(r => {
      domCount[r.dom] = (domCount[r.dom] || 0) + 1;
    });
    const focus = s.focus;
    let best: Question | null = null,
      bestScore = Infinity;
    for (const q of source) {
      const diffGap = Math.abs(q.diff - s.difficulty);
      const domPenalty = (domCount[q.dom] || 0) * 0.6;
      const jitter = Math.random() * 0.5;
      let sc = diffGap * 2 + domPenalty + jitter;
      if (focus) {
        if (focus.domains.includes(q.dom)) sc -= 1.5;
        if (q.tag && focus.tags.includes(q.tag)) sc -= 3;
      }
      if (sc < bestScore) {
        bestScore = sc;
        best = q;
      }
    }
    return best;
  }

  publicQuestion(s: Session): QuestionView | null {
    const cur = s.current;
    const q = cur && this.byId.get(cur.id);
    if (!cur || !q) return null;
    return {
      questionNumber: s.responses.length + 1,
      testLength: s.testLength,
      domain: q.dom,
      domainName: this.domainName(q.dom),
      difficulty: q.diff,
      prompt: q.q,
      img: q.img || null,
      options: cur.opts
    };
  }

  answer(s: Session, chosenIndex: number, used: Set<string>): AnswerResult {
    const cur = s.current;
    const q = cur && this.byId.get(cur.id);
    if (!cur || !q || s.finishedAt) throw new Error('No question to answer.');
    s.lastActivityAt = new Date().toISOString();
    const isCorrect = chosenIndex === cur.correctIndex;
    const before = s.difficulty;
    s.difficulty = Math.min(5, Math.max(1, s.difficulty + (isCorrect ? 1 : -1)));
    const rec: ResponseRecord = {
      order: s.responses.length + 1,
      id: q.id,
      dom: q.dom,
      domName: this.domainName(q.dom),
      difficultyBefore: cur.targetAtServe,
      itemDifficulty: q.diff,
      diff: q.diff,
      q: q.q,
      opts: cur.opts,
      img: q.img || null,
      chosen: chosenIndex,
      chosenText: cur.opts[chosenIndex],
      correct: cur.correctIndex,
      correctText: cur.opts[cur.correctIndex],
      isCorrect,
      why: q.why,
      tip: q.tip,
      time: Math.round((Date.now() - cur.servedAt) / 1000),
      difficultyAfter: s.difficulty,
      adaptiveMove: s.difficulty > before ? 'up' : s.difficulty < before ? 'down' : 'hold'
    };
    s.responses.push(rec);

    let next: QuestionView | null = null;
    if (s.responses.length >= s.testLength) {
      this.finish(s, null);
    } else {
      const qNext = this.pickNext(s, used);
      if (!qNext) this.finish(s, 'bank-exhausted');
      else {
        this.serveQuestion(s, qNext, used);
        next = this.publicQuestion(s);
      }
    }
    return {
      isCorrect,
      correctIndex: cur.correctIndex,
      correctText: cur.opts[cur.correctIndex],
      why: q.why,
      tip: q.tip,
      finished: !!s.finishedAt,
      next
    };
  }

  finish(s: Session, reason: Session['endedReason']): void {
    if (s.finishedAt) return;
    s.finishedAt = new Date().toISOString();
    s.endedReason = reason;
    s.current = null;
    s.summary = this.buildSummary(s);
  }

  domainStats(s: Session): Record<string, { c: number; t: number }> {
    const stats: Record<string, { c: number; t: number }> = {};
    Object.keys(this.domains).forEach(d => {
      stats[d] = { c: 0, t: 0 };
    });
    s.responses.forEach(r => {
      (stats[r.dom] ??= { c: 0, t: 0 }).t++;
      if (r.isCorrect) stats[r.dom].c++;
    });
    return stats;
  }

  buildSummary(s: Session): Summary {
    const rs = s.responses;
    const right = rs.filter(r => r.isCorrect).length;
    const total = rs.length;
    const correctDiffs = rs.filter(r => r.isCorrect).map(r => r.itemDifficulty);
    const avgLvl = correctDiffs.length ? correctDiffs.reduce((a, b) => a + b, 0) / correctDiffs.length : 0;
    const stats = this.domainStats(s);
    const domainBreakdown: Summary['domainBreakdown'] = {};
    Object.keys(stats).forEach(d => {
      if (stats[d].t > 0)
        domainBreakdown[d] = {
          name: this.domainName(d),
          correct: stats[d].c,
          total: stats[d].t,
          percent: Math.round((stats[d].c / stats[d].t) * 100)
        };
    });
    return {
      student: s.name || null,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      correct: right,
      total,
      percent: total ? Math.round((right / total) * 100) : 0,
      practiceLevel: correctDiffs.length ? Math.max(1, Math.round(avgLvl)) : null,
      averageCorrectLevel: correctDiffs.length ? Number(avgLvl.toFixed(2)) : null,
      peakLevelReached: rs.length ? Math.max(...rs.map(r => r.itemDifficulty)) : null,
      totalTimeSeconds: rs.reduce((a, r) => a + (r.time || 0), 0),
      domainBreakdown,
      path: rs.map(r => ({ order: r.order, itemLevel: r.itemDifficulty, correct: r.isCorrect, dom: r.dom }))
    };
  }

  computeInsights(s: Session): Insight[] {
    const rs = s.responses;
    const out: Insight[] = [];

    if (sessionStatus(s) === 'idle') {
      const mins = Math.round((Date.now() - new Date(s.lastActivityAt).getTime()) / 60000);
      out.push({ tone: 'warn', text: `No answer for ${mins} minutes — they may have stepped away or closed the tab.` });
    }
    if (s.endedReason === 'ended-in-admin') out.push({ tone: 'neutral', text: 'Ended early from admin mode.' });

    if (!rs.length) {
      out.push({ tone: 'neutral', text: 'Waiting for the first answer…' });
      return out;
    }

    const recent = rs.slice(-5);
    const recentRight = recent.filter(r => r.isCorrect).length;
    out.push({
      tone: recentRight >= 4 ? 'good' : recentRight <= 1 ? 'warn' : 'neutral',
      text: `Last ${recent.length}: ${recentRight}/${recent.length} correct.`
    });

    const lastFew = rs.slice(-4).map(r => r.difficultyAfter);
    if (lastFew.length >= 2) {
      const trend = lastFew[lastFew.length - 1] - lastFew[0];
      if (trend > 0) out.push({ tone: 'good', text: `Difficulty is climbing — currently level ${s.difficulty}.` });
      else if (trend < 0)
        out.push({ tone: 'warn', text: `Difficulty has been easing off — currently level ${s.difficulty}.` });
      else out.push({ tone: 'neutral', text: `Difficulty is holding steady at level ${s.difficulty}.` });
    }

    let streak = 0,
      streakType: boolean | null = null;
    for (let i = rs.length - 1; i >= 0; i--) {
      const t = rs[i].isCorrect;
      if (streakType === null) {
        streakType = t;
        streak = 1;
      } else if (t === streakType) streak++;
      else break;
    }
    if (streak >= 3)
      out.push({
        tone: streakType ? 'good' : 'warn',
        text: `${streak}-question ${streakType ? 'correct' : 'miss'} streak in a row.`
      });

    const stats = this.domainStats(s);
    const weak = Object.keys(stats).filter(d => stats[d].t >= 2 && stats[d].c / stats[d].t < 0.6);
    if (weak.length)
      out.push({ tone: 'warn', text: `Struggling with: ${weak.map(d => this.domainName(d)).join(', ')}.` });
    const strong = Object.keys(stats).filter(d => stats[d].t >= 2 && stats[d].c / stats[d].t >= 0.85);
    if (strong.length)
      out.push({ tone: 'good', text: `Strong in: ${strong.map(d => this.domainName(d)).join(', ')}.` });

    const times = rs.map(r => r.time).filter(t => typeof t === 'number');
    if (times.length >= 3) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const lastTime = times[times.length - 1];
      if (lastTime <= 3 && avgTime > 8)
        out.push({
          tone: 'warn',
          text: `Last answer took only ${lastTime}s (avg is ${Math.round(avgTime)}s) — might be guessing.`
        });
      if (lastTime > avgTime * 2.5 && avgTime > 4)
        out.push({
          tone: 'neutral',
          text: `Last answer took ${lastTime}s, well above the ${Math.round(avgTime)}s average — may be a tough one.`
        });
    }
    if (s.finishedAt) out.push({ tone: 'good', text: 'Test complete.' });
    return out;
  }

  buildPaper(opts: {
    title: string;
    fromDate: string | null;
    toDate: string | null;
    domains: string[];
    minDiff: number;
    maxDiff: number;
    count: number | null;
  }): Paper {
    const dom = opts.domains.length ? opts.domains.filter(d => this.domains[d]) : Object.keys(this.domains);
    const lo = Number.isFinite(opts.minDiff) ? opts.minDiff : 1;
    const hi = Number.isFinite(opts.maxDiff) ? opts.maxDiff : 5;
    let pool = this.questions.filter(q => dom.includes(q.dom) && q.diff >= lo && q.diff <= hi);
    if (opts.fromDate) pool = pool.filter(q => (q.addedAt || '') >= opts.fromDate!);
    if (opts.toDate) pool = pool.filter(q => (q.addedAt || '') <= opts.toDate!);
    const n = opts.count && opts.count > 0 ? Math.floor(opts.count) : pool.length;
    const chosen = shuffle(pool).slice(0, n);
    const criteria: PaperCriteria = {
      fromDate: opts.fromDate,
      toDate: opts.toDate,
      domains: dom,
      minDiff: lo,
      maxDiff: hi,
      count: n
    };
    return {
      id: newId(),
      title: (opts.title || 'Untitled paper').slice(0, 80),
      createdAt: new Date().toISOString(),
      criteria,
      questionIds: chosen.map(q => q.id)
    };
  }
}

export function sessionStatus(s: Session): 'finished' | 'idle' | 'live' {
  if (s.finishedAt) return 'finished';
  if (Date.now() - new Date(s.lastActivityAt).getTime() > IDLE_MS) return 'idle';
  return 'live';
}
