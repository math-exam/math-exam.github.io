import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.runtime
Object.defineProperty(global, 'chrome', {
  value: { runtime: { lastError: null } },
  writable: true
});

// Mock console
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  get length() {
    return 0;
  }
};
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });

// Mock window.chrome for Google OAuth
Object.defineProperty(global, 'window', {
  value: { chrome: { runtime: {} } },
  writable: true
});

describe('auth.ts - AuthError', () => {
  it('extends Error', async () => {
    const { AuthError } = await import('../src/auth');
    const error = new AuthError('test message');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('test message');
  });
});

describe('auth.ts - waitFor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves immediately when check succeeds', async () => {
    const { waitFor } = await import('../src/auth');
    await expect(waitFor(() => true, 100)).resolves.toBeUndefined();
  });

  it('rejects on timeout when check never succeeds', async () => {
    const { waitFor } = await import('../src/auth');
    await expect(waitFor(() => false, 50)).rejects.toThrow('Google scripts failed to load.');
  });
});
