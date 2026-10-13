import { boot } from '../boot';
import { loadStatic } from '../data';
import * as drive from '../drive';
import { type Engine, sessionStatus } from '../engine';
import { openAppFolder } from '../store';
import type { CurrentFile, ResponseRecord, Session, SessionsFile } from '../types';
import { $, domainBars, drawPath, errorText, esc, showOnly } from '../ui';

const show = (id: string) => showOnly(['signin', 'loading', 'detail'], id);
const params = new URLSearchParams(location.search);
const sessionId = params.get('id');

let engine: Engine;
let session: Session;
let filter: 'all' | 'wrong' = 'all';

async function main(): Promise<void> {
  const staticData = loadStatic();
  await boot();
  show('loading');
  try {
    ({ engine } = await staticData);
    if (!sessionId) throw new Error('Session not found.');
    const ids = await openAppFolder();
    const load = async (): Promise<Session | null> => {
      const cur = await drive.readJson<CurrentFile>(ids.current);
      if (cur.session?.id === sessionId) return cur.session;
      const all = await drive.readJson<SessionsFile>(ids.sessions);
      return all.sessions.find(s => s.id === sessionId) ?? null;
    };
    const s = await load();
    if (!s) throw new Error('Session not found.');
    session = s;
    render();
    show('detail');
    const timer = window.setInterval(async () => {
      if (session.finishedAt) {
        clearInterval(timer);
        return;
      }
      try {
        const s2 = await load();
        if (s2) {
          session = s2;
          render();
        }
      } catch {}
    }, 5000);
  } catch (e) {
    $('#loadingMsg').textContent = errorText(e);
  }
}

function render(): void {
  const s = session;
  const sum = engine.buildSummary(s);
  const status = sessionStatus(s);
  document.title = `${document.title.split(' — ')[0]} — ${s.name}`;
  $('#sessionTitle').textContent = s.title;
  $('#statusPill').className = `pill ${status === 'finished' ? 'done' : status}`;
  $('#statusPill').textContent =
    status === 'finished'
      ? s.endedReason === 'ended-in-admin'
        ? 'Ended early'
        : 'Finished'
      : status === 'idle'
        ? 'Idle'
        : 'Active';
  $('#studentName').textContent = s.name;
  $('#score').textContent = `${sum.correct} / ${sum.total}`;
  $('#level').textContent = sum.practiceLevel ? `L${sum.practiceLevel}` : '—';
  $('#startTime').textContent = new Date(s.startedAt).toLocaleString();
  $('#endTime').textContent = s.finishedAt ? new Date(s.finishedAt).toLocaleString() : '—';
  $('#timeSpent').textContent = `${Math.round(sum.totalTimeSeconds / 60)} min`;
  $('#insights').innerHTML = engine
    .computeInsights(s)
    .map(i => `<div class="insight ${i.tone}">${esc(i.text)}</div>`)
    .join('');
  drawPath($('#path') as unknown as SVGElement, s.responses);
  domainBars($('#domains'), sum.domainBreakdown, engine.domains);
  renderLog();
}

function renderLog(): void {
  const rows = filter === 'wrong' ? session.responses.filter(r => !r.isCorrect) : session.responses;
  const tbody = $('#logBody');
  tbody.innerHTML = rows.length ? '' : '<tr><td colspan="5" class="fine">No questions matched.</td></tr>';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `<td>${r.order}</td><td>${esc(r.domName)}</td><td>L${r.itemDifficulty}</td><td>${r.isCorrect ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'}</td><td>${r.time}s</td>`;
    tr.addEventListener('click', () => toggleDetail(tr, r));
    tbody.appendChild(tr);
  });
}

function toggleDetail(row: HTMLTableRowElement, r: ResponseRecord): void {
  const open = row.nextElementSibling;
  if (open?.classList.contains('expanded-detail')) {
    open.remove();
    return;
  }
  document.querySelectorAll('.expanded-detail').forEach(el => el.remove());
  const colors = { up: 'var(--indigo)', down: 'var(--coral)', hold: 'var(--amber)' };
  const tr = document.createElement('tr');
  tr.className = 'expanded-detail';
  tr.innerHTML = `<td colspan="5"><div class="detail-box">
    <div><b>Question:</b> ${r.q}</div>
    ${r.img ? `<div class="q-img">${r.img}</div>` : ''}
    <div><b>Chose:</b> ${r.isCorrect ? '✓' : '✗'} ${r.chosenText}</div>
    ${r.isCorrect ? '' : `<div><b>Correct answer:</b> ${r.correctText}</div>`}
    <div><b>Explanation:</b> ${r.why}</div>
    <div><b>Tip:</b> ${r.tip}</div>
    <div><b>Adaptive move:</b> <span style="color:${colors[r.adaptiveMove]}">${r.adaptiveMove}</span> (L${r.difficultyBefore} → L${r.difficultyAfter})</div>
  </div></td>`;
  row.after(tr);
}

$('#filterAll').addEventListener('click', () => {
  filter = 'all';
  renderLog();
});
$('#filterWrong').addEventListener('click', () => {
  filter = 'wrong';
  renderLog();
});

void main();
