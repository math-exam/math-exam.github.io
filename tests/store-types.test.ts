import { describe, it, expect } from 'vitest';

describe('FILE_NAMES', () => {
  it('has correct file names', async () => {
    const { FILE_NAMES } = await import('../src/store');
    expect(FILE_NAMES.current).toBe('current.json');
    expect(FILE_NAMES.sessions).toBe('sessions.json');
    expect(FILE_NAMES.state).toBe('state.json');
    expect(FILE_NAMES.assignments).toBe('assignments.json');
  });

  it('has exactly 4 file names', async () => {
    const { FILE_NAMES } = await import('../src/store');
    expect(Object.keys(FILE_NAMES)).toHaveLength(4);
  });

  it('all FILE_NAMES values are const strings', async () => {
    const { FILE_NAMES } = await import('../src/store');
    expect(Object.values(FILE_NAMES).every(v => typeof v === 'string')).toBe(true);
  });
});

describe('ConflictError', () => {
  it('extends Error', async () => {
    const { ConflictError } = await import('../src/store');
    const error = new ConflictError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('test');
  });
});
