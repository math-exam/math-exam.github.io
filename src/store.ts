import { AuthError } from './auth';
import { APP_NAME } from './config';
import * as drive from './drive';
import type { AppState, AssignmentsFile, CurrentFile, SessionsFile } from './types';

export const FILE_NAMES = {
  current: 'current.json',
  sessions: 'sessions.json',
  state: 'state.json',
  assignments: 'assignments.json'
} as const;
export type FileKey = keyof typeof FILE_NAMES;
export type FileIds = Record<FileKey, string>;

const DEFAULTS: { [K in FileKey]: unknown } = {
  current: { session: null, writerId: null } satisfies CurrentFile,
  sessions: { sessions: [] } satisfies SessionsFile,
  state: { usedQuestionIds: [], lastActivityAt: null } satisfies AppState,
  assignments: { assignments: [] } satisfies AssignmentsFile
};

export async function openAppFolder(): Promise<FileIds> {
  const folder = (await drive.findOwnFolder(APP_NAME)) ?? (await drive.createFolder(APP_NAME));
  const files = await drive.listChildren(folder.id);
  const ids: Partial<FileIds> = {};
  for (const key of Object.keys(FILE_NAMES) as FileKey[]) {
    ids[key] =
      files.find(f => f.name === FILE_NAMES[key])?.id ??
      (await drive.createJson(folder.id, FILE_NAMES[key], DEFAULTS[key])).id;
  }
  return ids as FileIds;
}

export async function updateJson<T>(fileId: string, mutate: (data: T) => void): Promise<T> {
  const data = await drive.readJson<T>(fileId);
  mutate(data);
  await drive.writeJson(fileId, data);
  return data;
}

export type SaveStatus = 'saving' | 'saved' | 'retrying' | 'signed-out' | 'conflict';
export class ConflictError extends Error {}

interface Pending {
  data: unknown;
  force: boolean;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class WriteQueue {
  private pending = new Map<string, Pending>();
  private running = false;
  private stopped = false;
  private failures = 0;

  constructor(
    private onStatus: (s: SaveStatus) => void,
    private guard: (fileId: string) => Promise<void> = async () => {}
  ) {}

  get busy(): boolean {
    return this.running || this.pending.size > 0;
  }

  write(fileId: string, data: unknown, force = false): void {
    if (this.stopped) return;
    const prev = this.pending.get(fileId);
    this.pending.delete(fileId);
    this.pending.set(fileId, { data, force: force || !!prev?.force });
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.pending.size && !this.stopped) {
      const [fileId, item] = this.pending.entries().next().value as [string, Pending];
      this.pending.delete(fileId);
      this.onStatus('saving');
      try {
        if (!item.force) await this.guard(fileId);
        await drive.writeJson(fileId, item.data);
        this.failures = 0;
      } catch (e) {
        if (e instanceof ConflictError) {
          this.stopped = true;
          this.pending.clear();
          this.onStatus('conflict');
          break;
        }
        if (!this.pending.has(fileId)) this.pending.set(fileId, item);
        this.failures++;
        this.onStatus(e instanceof AuthError ? 'signed-out' : 'retrying');
        await sleep(Math.min(30_000, 2000 * 2 ** Math.min(this.failures - 1, 4)));
      }
    }
    this.running = false;
    if (!this.stopped) this.onStatus('saved');
  }
}
