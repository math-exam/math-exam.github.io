import { describe, it, expect } from 'vitest';

describe('ui.ts utility functions', () => {
  describe('esc', () => {
    it('escapes HTML special characters', async () => {
      const { esc } = await import('../src/ui');

      expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(esc('hello & goodbye')).toBe('hello &amp; goodbye');
      expect(esc("test 'quotes'")).toBe('test &#39;quotes&#39;');
      expect(esc('100%')).toBe('100%');
    });

    it('handles null and undefined', async () => {
      const { esc } = await import('../src/ui');

      expect(esc(null)).toBe('');
      expect(esc(undefined)).toBe('');
    });

    it('handles non-string types', async () => {
      const { esc } = await import('../src/ui');

      expect(esc(123)).toBe('123');
      expect(esc(true)).toBe('true');
      expect(esc({})).toBe('[object Object]');
    });
  });

  describe('fmtWhen', () => {
    it('formats ISO date string', async () => {
      const { fmtWhen } = await import('../src/ui');

      const now = new Date().toISOString();
      const result = fmtWhen(now);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('ago', () => {
    it('returns "never" for null', async () => {
      const { ago } = await import('../src/ui');
      expect(ago(null)).toBe('never');
    });

    it('returns "just now" for recent time', async () => {
      const { ago } = await import('../src/ui');
      const recent = new Date().toISOString();
      expect(ago(recent)).toBe('just now');
    });
  });

  describe('errorText', () => {
    it('extracts message from Error', async () => {
      const { errorText } = await import('../src/ui');

      const error = new Error('test error message');
      expect(errorText(error)).toBe('test error message');
    });

    it('returns string representation for non-errors', async () => {
      const { errorText } = await import('../src/ui');

      expect(errorText('string error')).toBe('string error');
      expect(errorText(123)).toBe('123');
    });
  });
});
