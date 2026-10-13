import { refreshIfExpiringSoon } from '../auth';
import { boot, signOutAndReload, type User } from '../boot';
import { loadStatic } from '../data';
import * as drive from '../drive';
import { Engine, newId } from '../engine';
import { ConflictError, type FileIds, openAppFolder, type SaveStatus, WriteQueue } from '../store';
import type {
  AnswerResult,
  AppState,
  Assignment,
  AssignmentsFile,
  CurrentFile,
  Paper,
  QuestionView,
  Session,
  SessionsFile
} from '../types';
import { $, domainBars, drawPath, errorText, esc, fmtWhen, setStatus, showOnly } from '../ui';

const show = (id: string) => showOnly(['signin', 'loading', 'home', 'quiz', 'results'], id);

let user: User;
let engine: Engine;
let papers: Map<string, Paper>;
let ids: FileIds;
let assignments: AssignmentsFile;
let sessions: SessionsFile;
let state: AppState;
let current: CurrentFile;
let used = new Set<string>();
const writerId = newId();

let session: Session | null = null;
let question: QuestionView | null = null;
let answered = false;
let lastResult: AnswerResult | null = null;

const queue = new WriteQueue(onSaveStatus, async fileId => {
  if (fileId !== ids.current) return;
  const remote = await drive.readJson<CurrentFile>(ids.current);
  if (remote.writerId !== writerId) throw new ConflictError();
});

function onSaveStatus(s: SaveStatus): void {
  if (s === 'conflict') {
    session = null;
    show('loading');
    $('#loadingMsg').textContent =
      'This test was ended in admin mode or continued in another tab. Reload the page to continue.';
  } else if (s === 'retrying') setStatus('Having trouble saving — will keep retrying…', 'warn');
  else if (s === 'signed-out') setStatus('Signed out of Google — reconnect to save your answers.', 'warn');
  else setStatus('');
}

async function main(): Promise<void> {
  const staticData = loadStatic();
  user = await boot();
  show('loading');
  try {
    ({ engine, papers } = await staticData);
    ids = await openAppFolder();
    [current, sessions, state, assignments] = await Promise.all([
      drive.readJson<CurrentFile>(ids.current),
      drive.readJson<SessionsFile>(ids.sessions),
      drive.readJson<AppState>(ids.state),
      drive.readJson<AssignmentsFile>(ids.assignments)
    ]);
    used = new Set(state.usedQuestionIds);
    renderHome();
    show('home');
  } catch (e) {
    $('#loadingMsg').textContent = `Something went wrong: ${errorText(e)}`;
  }
}

function firstName(): string {
  return user.displayName.split(' ')[0] || user.displayName;
}

function persistState(): void {
  state.usedQuestionIds = [...used];
  state.lastActivityAt = new Date().toISOString();
  queue.write(ids.state, state);
}

function archive(s: Session): void {
  sessions.sessions.push(s);
  queue.write(ids.sessions, sessions);
  current = { session: null, writerId };
  queue.write(ids.current, current);
}

function assignmentCount(a: Assignment): number {
  if (a.kind === 'adaptive') return a.testLength;
  if (a.kind === 'custom') return a.paper.questionIds.length;
  return papers.get(a.paperId)?.questionIds.length ?? 0;
}

function renderHome(): void {
  $('#homeName').textContent = firstName();
  $('#homeEmail').textContent = user.emailAddress;
  const done = new Set(sessions.sessions.map(s => s.assignmentId));
  const inProgress = current.session && !current.session.finishedAt ? current.session : null;
  const todo = assignments.assignments.filter(a => !done.has(a.id));

  const todoBox = $('#todoList');
  todoBox.innerHTML = '';
  if (inProgress && !todo.some(a => a.id === inProgress.assignmentId)) {
    todoBox.appendChild(
      todoRow(inProgress.title, `${inProgress.responses.length} of ${inProgress.testLength} answered`, 'Resume', () =>
        resume(inProgress)
      )
    );
  }
  todo.forEach(a => {
    const isCurrent = inProgress?.assignmentId === a.id;
    const n = assignmentCount(a);
    const detail = isCurrent
      ? `${inProgress!.responses.length} of ${inProgress!.testLength} answered`
      : `${n} question${n === 1 ? '' : 's'} · ${a.kind === 'adaptive' ? 'adapts to you' : 'fixed set'} · added ${fmtWhen(a.assignedAt)}`;
    todoBox.appendChild(
      todoRow(a.title, detail, isCurrent ? 'Resume' : 'Start', () => (isCurrent ? resume(inProgress!) : startTest(a)))
    );
  });
  $('#emptyTodo').classList.toggle('hide', todoBox.children.length > 0);

  const doneBox = $('#doneList');
  doneBox.innerHTML = '';
  [...sessions.sessions].reverse().forEach(s => {
    const sum = s.summary ?? engine.buildSummary(s);
    const row = document.createElement('div');
    row.className = 'sess-row';
    row.innerHTML = `<span class="who"><span>${esc(s.title)}</span><small>${fmtWhen(s.startedAt)}${s.endedReason === 'ended-in-admin' ? ' · ended early' : ''}</small></span><span class="pill done">${sum.correct}/${sum.total}</span>`;
    row.addEventListener('click', () => showResults(s));
    doneBox.appendChild(row);
  });
  if (!doneBox.children.length) doneBox.innerHTML = '<p class="fine">No finished tests yet.</p>';

  const total = engine.questions.length;
  $('#bankLine').textContent =
    `Question bank: ${Math.max(0, total - used.size)} of ${total} fresh questions left before any repeats.`;
}

function todoRow(title: string, detail: string, action: string, onClick: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'paper-row';
  row.innerHTML = `<span class="who"><span>${esc(title)}</span><small>${esc(detail)}</small></span>`;
  const btn = document.createElement('button');
  btn.className = 'btn small';
  btn.textContent = action;
  btn.addEventListener('click', onClick);
  row.appendChild(btn);
  return row;
}

function startTest(a: Assignment): void {
  refreshIfExpiringSoon();
  const prev = current.session && !current.session.finishedAt ? current.session : null;
  if (
    prev &&
    !confirm(`"${prev.title}" is still in progress. Stop it and start "${a.title}"? Answers so far are kept.`)
  )
    return;
  try {
    session = engine.startSession(user.displayName, a, papers, used);
  } catch (e) {
    alert(errorText(e));
    return;
  }
  if (prev) {
    engine.finish(prev, null);
    sessions.sessions.push(prev);
    queue.write(ids.sessions, sessions);
  }
  current = { session, writerId };
  queue.write(ids.current, current, true);
  persistState();
  show('quiz');
  renderQuestion(engine.publicQuestion(session)!);
}

function resume(s: Session): void {
  refreshIfExpiringSoon();
  session = s;
  if (session.current) session.current.servedAt = Date.now();
  current = { session, writerId };
  queue.write(ids.current, current, true);
  show('quiz');
  renderQuestion(engine.publicQuestion(session)!);
}

function renderQuestion(q: QuestionView): void {
  question = q;
  $('#qcount').textContent = `Question ${q.questionNumber} of ${q.testLength}`;
  $('#progressFill').style.width = ((q.questionNumber - 1) / q.testLength) * 100 + '%';
  const bars = $('#levelBars').children;
  for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < q.difficulty);
  $('#domainTag').textContent = q.domainName;
  const imgBox = $('#questionImg');
  imgBox.innerHTML = q.img || '';
  imgBox.classList.toggle('hide', !q.img);
  $('#questionText').textContent = q.prompt;
  const box = $('#options');
  box.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.innerHTML = `<span class="key">${i + 1}</span><span>${opt}</span>`;
    b.addEventListener('click', () => choose(i));
    box.appendChild(b);
  });
  $('#feedback').className = 'feedback';
  answered = false;
}

const VERDICTS_OK = ['Correct!', 'Nailed it!', 'You got it!', 'Yes!'];
const VERDICTS_NO = ['Not quite.', "Almost — let's look.", 'Good try.', 'Close one.'];
const verdictIdx = { ok: 0, no: 0 };

function choose(i: number): void {
  if (answered || !session) return;
  refreshIfExpiringSoon();
  answered = true;
  const opts = $('#options').children as HTMLCollectionOf<HTMLButtonElement>;
  for (let k = 0; k < opts.length; k++) opts[k].disabled = true;

  const result = engine.answer(session, i, used);
  if (result.finished) archive(session);
  else queue.write(ids.current, current);
  persistState();

  for (let k = 0; k < opts.length; k++) {
    if (k === result.correctIndex) opts[k].classList.add('correct');
    if (k === i && !result.isCorrect) opts[k].classList.add('wrong');
  }
  $('#feedback').className = 'feedback show ' + (result.isCorrect ? 'ok' : 'no');
  $('#verdict').textContent = result.isCorrect
    ? VERDICTS_OK[verdictIdx.ok++ % VERDICTS_OK.length]
    : VERDICTS_NO[verdictIdx.no++ % VERDICTS_NO.length];
  $('#why').innerHTML = result.isCorrect ? result.why : `The answer is <b>${result.correctText}</b>. ${result.why}`;
  lastResult = result;
  $('#nextBtn').textContent = result.finished ? 'See my results' : 'Next question';
  $('#nextBtn').focus();
}

function next(): void {
  if (!answered || !lastResult || !session) return;
  if (lastResult.finished) {
    const s = session;
    session = null;
    showResults(s);
    return;
  }
  renderQuestion(lastResult.next!);
}

const BAND_NAMES: Record<number, string> = {
  1: 'Building basics',
  2: 'Getting steady',
  3: 'On grade level',
  4: 'Stretching ahead',
  5: 'Challenge level'
};
let reviewState: { s: Session; showAll: boolean } | null = null;

function showResults(s: Session): void {
  const sum = s.summary ?? engine.buildSummary(s);
  const pct = sum.percent;
  const who = firstName();
  $('#resultTitle').textContent =
    pct >= 80 ? `Awesome work, ${who}!` : pct >= 55 ? `Solid effort, ${who}!` : `Good practice, ${who}!`;
  $('#resultLead').textContent =
    (s.endedReason === 'ended-in-admin' ? 'This test was ended early. ' : '') +
    (pct >= 80
      ? 'You answered most questions correctly and kept climbing to harder levels.'
      : pct >= 55
        ? 'You handled the on-level questions well. A little more practice on the tricky ones will push the score up.'
        : 'Everyone starts somewhere. Below is exactly what to review so the next test goes better.');

  const circ = 2 * Math.PI * 52;
  $('#ringArc').style.strokeDashoffset = String(circ * (1 - (sum.total ? sum.correct / sum.total : 0)));
  $('#ringArc').setAttribute('stroke', pct >= 55 ? '#15A34A' : '#F59E0B');
  $('#scorePct').textContent = pct + '%';
  $('#scoreFrac').textContent = `${sum.correct} / ${sum.total}`;
  const band = sum.practiceLevel;
  $('#levelReached').textContent = band
    ? `Practice level: ${band} — ${BAND_NAMES[band]}`
    : 'Practice level: keep going!';
  $('#levelExplain').textContent =
    'Based on the difficulty of the questions answered correctly. This is an informal practice estimate, not an official MAP RIT score.';

  drawPath($('#resultPath') as unknown as SVGElement, s.responses);
  $('#pathRead').textContent = sum.peakLevelReached
    ? `Each dot is a question. Green = correct, coral = missed. You reached level ${sum.peakLevelReached} at your peak.`
    : 'No questions answered.';
  domainBars($('#domainBreak'), sum.domainBreakdown, engine.domains);
  buildReview(s, false);
  renderHome();
  show('results');
}

function buildReview(s: Session, showAll: boolean): void {
  const rs = s.responses;
  const missed = rs.filter(r => !r.isCorrect);
  $('#missedBadge').textContent = String(missed.length);
  $('#reviewIntro').textContent =
    missed.length === 0
      ? "You didn't miss a single one — incredible. Here's a quick recap of the trickiest ideas you nailed."
      : `Here are the ${missed.length} question${missed.length > 1 ? 's' : ''} to focus on. For each one: what was asked, what you picked, the right answer, and one tip to get it next time.`;

  const list = showAll ? rs : missed.length ? missed : rs.slice(-3);
  const box = $('#review');
  box.innerHTML = list
    .map(r => {
      const ans = r.isCorrect
        ? `<div class="ans"><span class="lbl">Answer</span><span class="right">${r.correctText} ✓</span></div>`
        : `<div class="ans"><span class="lbl">You chose</span><span class="yours">${r.chosenText}</span></div><div class="ans"><span class="lbl">Answer</span><span class="right">${r.correctText}</span></div>`;
      return `<div class="ritem${r.isCorrect ? '' : ' missed'}"><div class="rq">${esc(r.domName)} · ${r.q}</div>${r.img ? `<div class="q-img">${r.img}</div>` : ''}${ans}<div class="tip"><b>Tip:</b> ${r.tip}</div></div>`;
    })
    .join('');

  const sum = s.summary ?? engine.buildSummary(s);
  const weak = Object.keys(sum.domainBreakdown).filter(d => sum.domainBreakdown[d].percent < 60);
  if (weak.length) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="ritem" style="border-color:#C9D4EE;background:#F4F7FB"><div class="rq">What to practice next</div>` +
        weak
          .map(
            d =>
              `<div class="tip" style="margin-top:8px"><b>${esc(engine.domainName(d))}:</b> ${esc(engine.domains[d]?.study ?? '')}</div>`
          )
          .join('') +
        '</div>'
    );
  }
  $('#showAllWrap').classList.toggle('hide', missed.length === 0);
  $('#showAllBtn').textContent = showAll ? 'Show only what to review' : 'Show every question';
  reviewState = { s, showAll };
}

document.addEventListener('keydown', e => {
  if ($('#quiz').classList.contains('hide') || !session || !question) return;
  if (!answered && ['1', '2', '3', '4'].includes(e.key)) {
    const idx = parseInt(e.key, 10) - 1;
    if ($('#options').children[idx]) choose(idx);
  } else if (answered && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    next();
  }
});

$('#nextBtn').addEventListener('click', next);
$('#homeBtn').addEventListener('click', () => {
  renderHome();
  show('home');
});
$('#showAllBtn').addEventListener('click', () => {
  if (reviewState) buildReview(reviewState.s, !reviewState.showAll);
});
$('#signOutBtn').addEventListener('click', e => {
  e.preventDefault();
  signOutAndReload();
});
window.addEventListener('beforeunload', e => {
  if (queue.busy) e.preventDefault();
});

void main();
