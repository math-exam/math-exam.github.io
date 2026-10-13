import { boot, signOutAndReload, type User } from '../boot';
import { TEST_LENGTH } from '../config';
import { loadStatic } from '../data';
import * as drive from '../drive';
import { Engine, newId, sessionStatus } from '../engine';
import { type FileIds, openAppFolder, updateJson } from '../store';
import type { AppState, Assignment, AssignmentsFile, CurrentFile, Paper, Session, SessionsFile } from '../types';
import { $, ago, domainBars, drawPath, errorText, esc, fmtWhen, setStatus, showOnly } from '../ui';

const show = (id: string) => showOnly(['signin', 'loading', 'main'], id);

let user: User;
let engine: Engine;
let papers: Map<string, Paper>;
let ids: FileIds;
let assignments: AssignmentsFile = { assignments: [] };
let sessions: Session[] = [];
let state: AppState | null = null;
let live: Session | null = null;
let liveVersion = '';

async function main(): Promise<void> {
  const staticData = loadStatic();
  user = await boot();
  show('loading');
  try {
    ({ engine, papers } = await staticData);
    ids = await openAppFolder();
    $('#meEmail').textContent = user.emailAddress;
    setupForms();
    await loadAll();
    show('main');
    setInterval(pollLive, 4000);
    setInterval(loadAll, 30_000);
  } catch (e) {
    $('#loadingMsg').textContent = `Something went wrong: ${errorText(e)}`;
  }
}

async function loadAll(): Promise<void> {
  try {
    const [a, s, st] = await Promise.all([
      drive.readJson<AssignmentsFile>(ids.assignments),
      drive.readJson<SessionsFile>(ids.sessions),
      drive.readJson<AppState>(ids.state)
    ]);
    assignments = a;
    sessions = s.sessions;
    state = st;
    renderAssignments();
    renderHistory();
    renderBank();
    await pollLive(true);
  } catch (e) {
    setStatus(errorText(e), 'warn');
  }
}

async function pollLive(force = false): Promise<void> {
  try {
    const meta = await drive.getMeta(ids.current);
    if (force !== true && meta.version === liveVersion) {
      renderLive();
      return;
    }
    const cur = await drive.readJson<CurrentFile>(ids.current);
    liveVersion = meta.version ?? '';
    const wasLive = live && !live.finishedAt;
    live = cur.session;
    renderLive();
    if (wasLive && !live) void loadAll();
  } catch {}
}

const STATUS_LABEL = { live: 'Active', idle: 'Idle', finished: 'Finished' } as const;

function renderLive(): void {
  const s = live && !live.finishedAt ? live : null;
  $('#liveEmpty').classList.toggle('hide', !!s);
  $('#liveBody').classList.toggle('hide', !s);
  const pill = $('#livePill');
  if (!s) {
    pill.className = 'pill';
    pill.textContent = '';
    return;
  }
  const status = sessionStatus(s);
  pill.className = `pill ${status === 'finished' ? 'done' : status}`;
  pill.textContent = STATUS_LABEL[status];
  const rs = s.responses;
  $('#liveTitle').textContent = `${s.title} · started ${fmtWhen(s.startedAt)}`;
  $('#liveQ').textContent = `${Math.min(rs.length + 1, s.testLength)} / ${s.testLength}`;
  $('#liveLevel').textContent = `L${s.difficulty}`;
  $('#liveScore').textContent = `${rs.filter(r => r.isCorrect).length} / ${rs.length}`;
  $('#liveLast').textContent = ago(rs.length ? s.lastActivityAt : null);
  const q = s.current ? engine.byId.get(s.current.id) : null;
  $('#liveCurrent').innerHTML = q ? `${esc(engine.domainName(q.dom))} · L${q.diff} — ${q.q}` : '—';
  $('#liveInsights').innerHTML = engine
    .computeInsights(s)
    .map(i => `<div class="insight ${i.tone}">${esc(i.text)}</div>`)
    .join('');
  drawPath($('#livePath') as unknown as SVGElement, rs);
  const stats = engine.domainStats(s);
  const breakdown: Record<string, { name: string; correct: number; total: number }> = {};
  Object.keys(stats).forEach(d => {
    if (stats[d].t) breakdown[d] = { name: engine.domainName(d), correct: stats[d].c, total: stats[d].t };
  });
  domainBars($('#liveDomains'), breakdown, engine.domains);
  ($('#liveDetail') as HTMLAnchorElement).href = detailUrl(s.id);
}

$('#endBtn').addEventListener('click', async () => {
  if (!live || !confirm(`End "${live.title}" now? A report is made from the answers so far.`)) return;
  try {
    const cur = await drive.readJson<CurrentFile>(ids.current);
    const s = cur.session;
    if (s && !s.finishedAt) {
      engine.finish(s, 'ended-in-admin');
      await updateJson<SessionsFile>(ids.sessions, f => {
        f.sessions.push(s);
      });
      await drive.writeJson(ids.current, { session: null, writerId: null } satisfies CurrentFile);
    }
    setStatus('Session ended.', 'good');
    await loadAll();
  } catch (e) {
    setStatus(errorText(e), 'warn');
  }
});

function detailUrl(sessionId: string): string {
  return `session.html?id=${encodeURIComponent(sessionId)}`;
}

function describe(a: Assignment): string {
  if (a.kind === 'adaptive') {
    const f = a.focus;
    const focus =
      f && (f.domains.length || f.tags.length)
        ? ` · focus: ${[...f.domains.map(d => engine.domainName(d)), ...f.tags].join(', ')}`
        : '';
    return `Adaptive · ${a.testLength} questions${focus}`;
  }
  const n = a.kind === 'custom' ? a.paper.questionIds.length : (papers.get(a.paperId)?.questionIds.length ?? 0);
  return `${a.kind === 'custom' ? 'Built paper' : 'Paper'} · ${n} questions`;
}

function renderAssignments(): void {
  const box = $('#assignList');
  const done = new Set(sessions.map(s => s.assignmentId));
  const active = assignments.assignments.filter(a => !done.has(a.id));
  box.innerHTML = active.length ? '' : '<p class="fine">No active assignments. Add one below.</p>';
  [...active].reverse().forEach(a => {
    const inProgress = live && !live.finishedAt && live.assignmentId === a.id;
    const row = document.createElement('div');
    row.className = 'paper-row';
    row.innerHTML = `<span class="who"><span>${esc(a.title)}</span><small>${esc(describe(a))} · added ${fmtWhen(a.assignedAt)}</small></span><span class="inline-form">${inProgress ? '<span class="pill live">In progress</span>' : ''}</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn ghost small';
    btn.textContent = 'Remove';
    btn.addEventListener('click', () =>
      mutate(x => {
        x.assignments = x.assignments.filter(y => y.id !== a.id);
      })
    );
    row.querySelector('.inline-form')!.appendChild(btn);
    box.appendChild(row);
  });
}

async function mutate(fn: (a: AssignmentsFile) => void, okMsg = ''): Promise<boolean> {
  try {
    assignments = await updateJson<AssignmentsFile>(ids.assignments, fn);
    renderAssignments();
    setStatus(okMsg, 'good');
    return true;
  } catch (e) {
    setStatus(errorText(e), 'warn');
    return false;
  }
}

function base(title: string): { id: string; title: string; assignedAt: string } {
  return { id: newId(), title, assignedAt: new Date().toISOString() };
}

function checks(boxSel: string): string[] {
  return [...document.querySelectorAll<HTMLInputElement>(`${boxSel} input:checked`)].map(i => i.value);
}

function setupForms(): void {
  const paperBox = $('#paperList');
  const list = [...papers.values()].sort((a, b) => a.title.localeCompare(b.title));
  paperBox.innerHTML = list.length ? '' : '<p class="fine">No papers in data/papers.</p>';
  list.forEach(p => {
    const row = document.createElement('div');
    row.className = 'paper-row';
    row.innerHTML = `<span class="who"><span>${esc(p.title)}</span><small>${p.questionIds.length} questions</small></span>`;
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = 'Add';
    btn.addEventListener('click', () =>
      mutate(a => {
        a.assignments.push({ ...base(p.title), kind: 'paper', paperId: p.id });
      }, `Added "${p.title}".`)
    );
    row.appendChild(btn);
    paperBox.appendChild(row);
  });

  const domainChecks = Object.keys(engine.domains)
    .map(d => `<label><input type="checkbox" value="${d}" /> ${esc(engine.domainName(d))}</label>`)
    .join('');
  $('#adDomains').innerHTML = domainChecks;
  $('#paperDomains').innerHTML = domainChecks;
  const tags = [...new Set(engine.questions.map(q => q.tag).filter((t): t is string => !!t))].sort();
  $('#adTags').innerHTML =
    tags.map(t => `<label><input type="checkbox" value="${esc(t)}" /> ${esc(t)}</label>`).join('') ||
    '<span class="fine">No tagged questions.</span>';
  $<HTMLInputElement>('#adLength').value = String(TEST_LENGTH);

  const counts: Record<string, number> = {};
  engine.questions.forEach(q => {
    const d = q.addedAt || 'unknown';
    counts[d] = (counts[d] || 0) + 1;
  });
  const opts =
    '<option value="">(any)</option>' +
    Object.keys(counts)
      .sort()
      .map(d => `<option value="${d}">${d} (${counts[d]})</option>`)
      .join('');
  $('#paperFrom').innerHTML = opts;
  $('#paperTo').innerHTML = opts;
}

$('#adAssignBtn').addEventListener('click', () => {
  const title = $<HTMLInputElement>('#adTitle').value.trim() || 'Adaptive practice';
  const len = Math.max(5, Math.min(100, Number($<HTMLInputElement>('#adLength').value) || TEST_LENGTH));
  const domains = checks('#adDomains'),
    tags = checks('#adTags');
  const focus = domains.length || tags.length ? { domains, tags, note: '' } : null;
  void mutate(a => {
    a.assignments.push({ ...base(title), kind: 'adaptive', focus, testLength: len });
  }, `Added "${title}".`).then(ok => {
    if (ok) $<HTMLInputElement>('#adTitle').value = '';
  });
});

$('#genPaperBtn').addEventListener('click', async () => {
  const paper = engine.buildPaper({
    title: $<HTMLInputElement>('#paperTitle').value.trim() || 'Untitled paper',
    fromDate: $<HTMLSelectElement>('#paperFrom').value || null,
    toDate: $<HTMLSelectElement>('#paperTo').value || null,
    domains: checks('#paperDomains'),
    minDiff: Number($<HTMLSelectElement>('#paperMinDiff').value),
    maxDiff: Number($<HTMLSelectElement>('#paperMaxDiff').value),
    count: $<HTMLInputElement>('#paperCount').value ? Number($<HTMLInputElement>('#paperCount').value) : null
  });
  const msg = $('#paperMsg');
  if (!paper.questionIds.length) {
    msg.textContent = 'No questions match those filters.';
    return;
  }
  if (
    await mutate(a => {
      a.assignments.push({ ...base(paper.title), kind: 'custom', paper });
    })
  ) {
    msg.textContent = `Added "${paper.title}" with ${paper.questionIds.length} questions.`;
    $<HTMLInputElement>('#paperTitle').value = '';
    $<HTMLInputElement>('#paperCount').value = '';
  }
});

function renderBank(): void {
  const total = engine.questions.length;
  const usedCount = state?.usedQuestionIds.length ?? 0;
  $('#bankLine').textContent =
    `${Math.max(0, total - usedCount)} of ${total} questions are still fresh for adaptive tests.`;
}

$('#resetBankBtn').addEventListener('click', async () => {
  if (!confirm('Make every question eligible again for adaptive tests? Past results are kept.')) return;
  try {
    state = await updateJson<AppState>(ids.state, s => {
      s.usedQuestionIds = [];
    });
    renderBank();
    setStatus('Question bank reset.', 'good');
  } catch (e) {
    setStatus(errorText(e), 'warn');
  }
});

function renderHistory(): void {
  const box = $('#historyList');
  box.innerHTML = sessions.length ? '' : '<p class="fine">No finished sessions yet.</p>';
  [...sessions].reverse().forEach(s => {
    const sum = s.summary ?? engine.buildSummary(s);
    const a = document.createElement('a');
    a.className = 'sess-row';
    a.href = detailUrl(s.id);
    a.innerHTML = `<span class="who"><span>${esc(s.title)}</span><small>${fmtWhen(s.startedAt)}${s.endedReason === 'ended-in-admin' ? ' · ended early' : ''}</small></span><span><span class="pill done">${sum.percent}%</span> <span class="fine">${sum.correct}/${sum.total}</span></span>`;
    box.appendChild(a);
  });
}

$('#signOutBtn').addEventListener('click', e => {
  e.preventDefault();
  signOutAndReload();
});

void main();
