import type { Domains, ResponseRecord } from './types';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
};

export function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

export function showOnly(ids: string[], id: string): void {
  ids.forEach(s => $('#' + s).classList.toggle('hide', s !== id));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : fmtWhen(iso);
}

export function setStatus(text: string, tone: 'neutral' | 'warn' | 'good' = 'neutral'): void {
  const el = document.querySelector<HTMLElement>('#statusBar');
  if (!el) return;
  el.textContent = text;
  el.className = `status-bar ${tone}${text ? '' : ' hide'}`;
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function drawPath(svg: SVGElement, rs: Pick<ResponseRecord, 'diff' | 'isCorrect'>[]): void {
  const w = 640,
    h = 190,
    padX = 30,
    padY = 26;
  const stepX = (w - padX * 2) / Math.max(1, rs.length - 1);
  const yFor = (d: number) => h - padY - ((d - 1) / 4) * (h - padY * 2);
  let grid = '',
    labels = '',
    line = '',
    dots = '';
  for (let d = 1; d <= 5; d++) {
    const y = yFor(d);
    grid += `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="#E6ECF5" stroke-width="1"/>`;
    labels += `<text x="${padX - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#8A99B0" font-weight="700">L${d}</text>`;
  }
  const dotR = rs.length > 28 ? 3.8 : 5.5;
  rs.forEach((r, i) => {
    const x = padX + i * stepX,
      y = yFor(r.diff);
    line += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR}" fill="${r.isCorrect ? '#15A34A' : '#F26A5B'}" stroke="#fff" stroke-width="1.5"><title>Q${i + 1}: level ${r.diff}, ${r.isCorrect ? 'correct' : 'missed'}</title></circle>`;
  });
  svg.innerHTML =
    grid +
    labels +
    `<path d="${line}" fill="none" stroke="#4F46E5" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
    dots;
}

export function domainBars(
  box: HTMLElement,
  breakdown: Record<string, { name: string; correct: number; total: number }>,
  domains: Domains
): void {
  box.innerHTML =
    Object.keys(breakdown)
      .map(d => {
        const s = breakdown[d];
        const p = s.total ? Math.round((s.correct / s.total) * 100) : 0;
        return `<div class="drow"><div class="dn">${esc(s.name)}</div><div class="dbar"><i style="width:${p}%;background:${domains[d]?.color ?? '#4F46E5'}"></i></div><div class="dpct">${s.correct}/${s.total}</div></div>`;
      })
      .join('') || '<p class="fine">No answers yet.</p>';
}
