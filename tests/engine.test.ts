import { describe, it, expect } from 'vitest';
import { shuffle, newId } from '../src/engine';

describe('shuffle', () => {
  it('returns a new array without mutating the original', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).not.toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves array length', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  it('contains all original elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original);
    expect(shuffled).toHaveLength(original.length);
    for (const item of original) {
      expect(shuffled).toContain(item);
    }
  });

  it('handles empty arrays', () => {
    const result = shuffle([]);
    expect(result).toEqual([]);
  });

  it('handles single-element arrays', () => {
    const arr = [42];
    const result = shuffle(arr);
    expect(result).toEqual([42]);
  });

  it('handles two-element arrays', () => {
    const arr = [1, 2];
    const result = shuffle(arr);
    expect(result).toHaveLength(2);
    expect(result.sort()).toEqual([1, 2]);
  });
});

describe('newId', () => {
  it('returns a string', () => {
    expect(typeof newId()).toBe('string');
  });

  it('returns a 16-character hex string', () => {
    const id = newId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(newId());
    }
    expect(ids.size).toBe(100);
  });
});
