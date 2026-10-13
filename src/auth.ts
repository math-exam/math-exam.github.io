import { DRIVE_SCOPE, GOOGLE_CLIENT_ID, STORAGE_PREFIX } from './config';

interface Token {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_KEY = STORAGE_PREFIX + 'token';
const HINT_KEY = STORAGE_PREFIX + 'loginHint';

let token: Token | null = loadToken();
let client: any = null;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;
const lostListeners: (() => void)[] = [];

export class AuthError extends Error {}

function loadToken(): Token | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null') as Token | null;
    return t && t.expiresAt > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

export function waitFor(check: () => boolean, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Google scripts failed to load.'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

export async function initAuth(): Promise<void> {
  await waitFor(() => typeof google !== 'undefined' && !!google.accounts?.oauth2);
  client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (resp: any) => {
      const p = pending;
      pending = null;
      if (resp.error) {
        p?.reject(new AuthError(resp.error_description || resp.error));
        return;
      }
      token = { accessToken: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in) * 1000 };
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
      } catch {}
      p?.resolve(token.accessToken);
    },
    error_callback: (err: any) => {
      const p = pending;
      pending = null;
      p?.reject(new AuthError(err?.type === 'popup_closed' ? 'Sign-in window was closed.' : 'Sign-in failed.'));
    }
  });
}

export function signIn(chooseAccount = false): Promise<string> {
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    const hint = localStorage.getItem(HINT_KEY) || undefined;
    client.requestAccessToken({
      prompt: chooseAccount ? 'select_account' : '',
      login_hint: chooseAccount ? undefined : hint
    });
  });
}

export function rememberEmail(email: string): void {
  try {
    localStorage.setItem(HINT_KEY, email);
  } catch {}
}

export function hasToken(): boolean {
  return !!token && token.expiresAt > Date.now() + 30_000;
}

export function accessToken(): string {
  if (!hasToken()) {
    notifyAuthLost();
    throw new AuthError('Signed out of Google.');
  }
  return token!.accessToken;
}

export function refreshIfExpiringSoon(): void {
  if (!client || pending || !token || token.expiresAt - Date.now() > 5 * 60_000) return;
  signIn().catch(() => {});
}

export function onAuthLost(cb: () => void): void {
  lostListeners.push(cb);
}

export function notifyAuthLost(): void {
  token = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
  lostListeners.forEach(cb => cb());
}

export function signOut(): void {
  if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token.accessToken, () => {});
  token = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(HINT_KEY);
  } catch {}
}
