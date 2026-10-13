import { hasToken, initAuth, onAuthLost, rememberEmail, signIn, signOut } from './auth';
import { APP_NAME, isConfigured } from './config';
import * as drive from './drive';
import { $, errorText } from './ui';

export interface User {
  displayName: string;
  emailAddress: string;
}

export async function boot(): Promise<User> {
  const card = $('#signin');
  const msg = $('#signinMsg');
  const btn = $<HTMLButtonElement>('#signInBtn');

  if (!isConfigured()) {
    card.classList.remove('hide');
    btn.disabled = true;
    msg.textContent = `${APP_NAME} isn't set up yet: add the Google OAuth client ID to src/config.ts (see README).`;
    return new Promise(() => {});
  }

  await initAuth();
  wireAuthBanner();

  if (hasToken()) {
    try {
      return await drive.me();
    } catch {}
  }

  card.classList.remove('hide');
  return new Promise(resolve => {
    btn.onclick = async () => {
      btn.disabled = true;
      msg.textContent = '';
      try {
        await signIn(true);
        const user = await drive.me();
        rememberEmail(user.emailAddress);
        card.classList.add('hide');
        resolve(user);
      } catch (e) {
        msg.textContent = errorText(e);
      } finally {
        btn.disabled = false;
      }
    };
  });
}

function wireAuthBanner(): void {
  const banner = document.querySelector<HTMLElement>('#authBanner');
  if (!banner) return;
  onAuthLost(() => banner.classList.remove('hide'));
  banner.querySelector('button')!.addEventListener('click', async () => {
    try {
      await signIn();
      banner.classList.add('hide');
    } catch {}
  });
}

export function signOutAndReload(): void {
  signOut();
  location.href = 'index.html';
}
