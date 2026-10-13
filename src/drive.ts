import { accessToken, AuthError, notifyAuthLost } from './auth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFile {
  id: string;
  name: string;
  version?: string;
  modifiedTime?: string;
  parents?: string[];
  owners?: { displayName: string; emailAddress: string; me?: boolean }[];
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken()}`);
  const res = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (res.status === 401) {
    notifyAuthLost();
    throw new AuthError('Signed out of Google.');
  }
  if (!res.ok) {
    let msg = `Drive request failed (${res.status})`;
    try {
      msg = (await res.json()).error?.message || msg;
    } catch {}
    throw new DriveError(msg, res.status);
  }
  return res;
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const FILE_FIELDS = 'id,name,version,modifiedTime,parents,owners(displayName,emailAddress,me)';

export async function me(): Promise<{ displayName: string; emailAddress: string }> {
  const res = await call(`${API}/about?fields=user(displayName,emailAddress)`);
  return (await res.json()).user;
}

export async function list(query: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `${query} and trashed=false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: '100',
      spaces: 'drive'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const body = await (await call(`${API}/files?${params}`)).json();
    out.push(...body.files);
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return out;
}

export async function findOwnFolder(name: string): Promise<DriveFile | null> {
  const files = await list(`name='${q(name)}' and mimeType='${FOLDER_MIME}' and 'me' in owners`);
  return files[0] ?? null;
}

export async function createFolder(name: string): Promise<DriveFile> {
  const res = await call(`${API}/files?fields=${FILE_FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME })
  });
  return res.json();
}

export function listChildren(folderId: string): Promise<DriveFile[]> {
  return list(`'${q(folderId)}' in parents`);
}

export async function createJson(folderId: string, name: string, data: unknown): Promise<DriveFile> {
  const boundary = 'b' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data) +
    `\r\n--${boundary}--`;
  const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  return res.json();
}

export async function readJson<T>(fileId: string): Promise<T> {
  return (await call(`${API}/files/${fileId}?alt=media`)).json();
}

export async function writeJson(fileId: string, data: unknown): Promise<DriveFile> {
  const res = await call(`${UPLOAD}/files/${fileId}?uploadType=media&fields=${FILE_FIELDS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getMeta(fileId: string): Promise<DriveFile> {
  return (await call(`${API}/files/${fileId}?fields=${FILE_FIELDS}`)).json();
}
