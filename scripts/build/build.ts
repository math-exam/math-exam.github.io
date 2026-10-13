import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { APP_NAME } from '../../src/config';
import type { Paper, Question } from '../../src/types';

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const QUESTIONS_DIR = path.join(ROOT, 'data', 'questions');
const PAPERS_DIR = path.join(ROOT, 'data', 'papers');
const HTML_DIR = path.join(ROOT, 'src', 'html');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');

const watch = process.argv.includes('--watch');
const port = Number(process.env.PORT) || 8000;

const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const jsonFiles = (dir: string) =>
  fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort();

function buildData(): void {
  const main = readJson(path.join(QUESTIONS_DIR, 'questions.json'));
  const questions: Question[] = main.questions.slice();
  for (const f of jsonFiles(QUESTIONS_DIR).filter(f => f !== 'questions.json')) {
    const set = readJson(path.join(QUESTIONS_DIR, f));
    if (!Array.isArray(set)) throw new Error(`data/questions/${f} must be an array of questions`);
    questions.push(...set);
  }
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`Duplicate question id ${q.id} in data/questions`);
    ids.add(q.id);
    if (!main.domains[q.dom]) throw new Error(`Question ${q.id} has unknown domain ${q.dom}`);
  }

  const papers: Paper[] = jsonFiles(PAPERS_DIR).map(f => {
    const p = readJson(path.join(PAPERS_DIR, f)) as Paper;
    const missing = p.questionIds.filter(id => !ids.has(id));
    if (missing.length) throw new Error(`data/papers/${f} references unknown question ids: ${missing.join(', ')}`);
    return p;
  });
  const paperIds = new Set<string>();
  for (const p of papers) {
    if (paperIds.has(p.id)) throw new Error(`Duplicate paper id ${p.id} in data/papers`);
    paperIds.add(p.id);
  }

  fs.writeFileSync(path.join(DIST, 'bank.json'), JSON.stringify({ domains: main.domains, questions }));
  fs.writeFileSync(path.join(DIST, 'papers.json'), JSON.stringify(papers));
  console.log(`bank: ${questions.length} questions, ${papers.length} papers`);
}

function buildHtml(): void {
  for (const f of fs.readdirSync(HTML_DIR)) {
    const src = path.join(HTML_DIR, f);
    if (f.endsWith('.html'))
      fs.writeFileSync(path.join(DIST, f), fs.readFileSync(src, 'utf8').replaceAll('{{APP_NAME}}', APP_NAME));
    else fs.copyFileSync(src, path.join(DIST, f));
  }
}

function typecheck(): void {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', ROOT], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function rebuildAssets(): void {
  try {
    buildData();
    buildHtml();
  } catch (e) {
    console.error(String(e));
    if (!watch) process.exit(1);
  }
}

async function main(): Promise<void> {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  if (!watch) typecheck();
  rebuildAssets();

  const options: esbuild.BuildOptions = {
    entryPoints: fs
      .readdirSync(PAGES_DIR)
      .filter(f => f.endsWith('.ts'))
      .map(f => path.join(PAGES_DIR, f)),
    outdir: DIST,
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: !watch,
    sourcemap: watch ? 'inline' : false,
    logLevel: 'info'
  };

  if (!watch) {
    await esbuild.build(options);
    return;
  }

  const ctx = await esbuild.context(options);
  await ctx.watch();
  for (const dir of [HTML_DIR, QUESTIONS_DIR, PAPERS_DIR]) {
    fs.watch(dir, () => rebuildAssets());
  }
  const { port: p } = await ctx.serve({ servedir: DIST, port });
  console.log(`Serving http://localhost:${p}/`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
