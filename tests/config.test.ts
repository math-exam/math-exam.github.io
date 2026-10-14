import { describe, it, expect } from 'vitest';

describe('Config', () => {
  it('has APP_NAME defined', async () => {
    const { APP_NAME } = await import('../src/config');
    expect(APP_NAME).toBe('MathPath');
  });

  it('has GOOGLE_CLIENT_ID defined', async () => {
    const { GOOGLE_CLIENT_ID } = await import('../src/config');
    expect(typeof GOOGLE_CLIENT_ID).toBe('string');
    expect(GOOGLE_CLIENT_ID).not.toBe('');
  });

  it('has DRIVE_SCOPE defined', async () => {
    const { DRIVE_SCOPE } = await import('../src/config');
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
  });

  it('has TEST_LENGTH defined', async () => {
    const { TEST_LENGTH } = await import('../src/config');
    expect(TEST_LENGTH).toBe(43);
  });

  it('has START_DIFF defined', async () => {
    const { START_DIFF } = await import('../src/config');
    expect(START_DIFF).toBe(3);
  });

  it('has IDLE_MS defined correctly', async () => {
    const { IDLE_MS } = await import('../src/config');
    expect(IDLE_MS).toBe(15 * 60 * 1000);
  });

  it('has STORAGE_PREFIX defined', async () => {
    const { STORAGE_PREFIX } = await import('../src/config');
    expect(STORAGE_PREFIX).toBe('MathPath:');
  });

  it('isConfigured returns true with real client ID', async () => {
    const { isConfigured } = await import('../src/config');
    expect(isConfigured()).toBe(true);
  });
});
