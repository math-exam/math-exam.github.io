export const APP_NAME = 'MathPath';

export const GOOGLE_CLIENT_ID = '27147624484-eefjessimd2mnk71v2odm9l49ec1s89u.apps.googleusercontent.com';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const TEST_LENGTH = 43;
export const START_DIFF = 3;
export const IDLE_MS = 15 * 60 * 1000;

export const STORAGE_PREFIX = `${APP_NAME}:`;

export function isConfigured(): boolean {
  return !GOOGLE_CLIENT_ID.startsWith('YOUR_');
}
