import { Engine } from './engine';
import type { Bank, Paper } from './types';

export async function loadStatic(): Promise<{ engine: Engine; papers: Map<string, Paper> }> {
  const [bank, papers] = await Promise.all([
    fetch('bank.json').then(r => r.json() as Promise<Bank>),
    fetch('papers.json').then(r => r.json() as Promise<Paper[]>)
  ]);
  return { engine: new Engine(bank), papers: new Map(papers.map(p => [p.id, p])) };
}
