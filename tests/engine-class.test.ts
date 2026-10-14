import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Engine } from '../src/engine';
import type { Bank, Question } from '../src/types';

describe('Engine', () => {
  let mockBank: Bank;
  let engine: Engine;

  beforeEach(() => {
    mockBank = {
      domains: {
        NS: { name: 'Number System', color: '#4F46E5', study: 'Test' },
        RP: { name: 'Ratios', color: '#0E9488', study: 'Test' }
      },
      questions: [
        { id: 'q1', dom: 'NS', diff: 3, q: 'Question 1', opts: ['a', 'b', 'c', 'd'], correct: 0, why: '', tip: '' },
        { id: 'q2', dom: 'RP', diff: 4, q: 'Question 2', opts: ['a', 'b', 'c', 'd'], correct: 1, why: '', tip: '' },
        { id: 'q3', dom: 'NS', diff: 3, q: 'Question 3', opts: ['a', 'b', 'c', 'd'], correct: 2, why: '', tip: '' }
      ]
    };
    engine = new Engine(mockBank);
  });

  it('initializes with bank questions', () => {
    expect(engine.questions).toHaveLength(3);
    expect(engine.byId.size).toBe(3);
  });

  it('creates a byId map', () => {
    expect(engine.byId.get('q1')).toBeDefined();
    expect(engine.byId.get('q1')?.q).toBe('Question 1');
    expect(engine.byId.get('nonexistent')).toBeUndefined();
  });

  describe('domainName', () => {
    it('returns the domain name for known domains', () => {
      expect(engine.domainName('NS')).toBe('Number System');
      expect(engine.domainName('RP')).toBe('Ratios');
    });

    it('returns the domain code for unknown domains', () => {
      expect(engine.domainName('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});
