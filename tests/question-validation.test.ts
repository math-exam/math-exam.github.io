import { describe, it, expect } from 'vitest';

const validDomains = ['NS', 'RP', 'EE', 'G', 'SP'];
const validDifficulties = [1, 2, 3, 4, 5];
const requiredFields: (keyof import('../src/types').Question)[] = [
  'id',
  'dom',
  'diff',
  'q',
  'opts',
  'correct',
  'why',
  'tip'
];

function validateQuestion(q: unknown): string[] {
  const errors: string[] = [];

  if (!q || typeof q !== 'object') {
    return ['Question must be an object'];
  }

  const question = q as Record<string, unknown>;

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in question)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate domain
  if (typeof question.dom === 'string' && !validDomains.includes(question.dom)) {
    errors.push(`Invalid domain: ${question.dom}. Must be one of ${validDomains.join(', ')}`);
  }

  // Validate difficulty
  if (typeof question.diff === 'number' && !validDifficulties.includes(question.diff)) {
    errors.push(`Invalid difficulty: ${question.diff}. Must be one of ${validDifficulties.join(', ')}`);
  }

  // Validate q
  if (typeof question.q !== 'string' || question.q.length === 0) {
    errors.push('q must be a non-empty string');
  }

  // Validate opts
  if (!Array.isArray(question.opts)) {
    errors.push('opts must be an array');
  } else if (question.opts.length !== 4) {
    errors.push(`opts must have exactly 4 options, got ${question.opts.length}`);
  } else {
    for (let i = 0; i < question.opts.length; i++) {
      if (typeof question.opts[i] !== 'string' || question.opts[i].length === 0) {
        errors.push(`opts[${i}] must be a non-empty string`);
      }
    }
  }

  // Validate correct
  if (typeof question.correct !== 'number' || question.correct < 0 || question.correct > 3) {
    errors.push(`correct must be an integer between 0 and 3, got ${question.correct}`);
  }

  // Validate why
  if (typeof question.why !== 'string') {
    errors.push('why must be a string');
  }

  // Validate tip
  if (typeof question.tip !== 'string') {
    errors.push('tip must be a string');
  }

  return errors;
}

function validateQuestionBulk(questions: unknown[]): string[] {
  const allErrors: string[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const errors = validateQuestion(questions[i]);
    for (const error of errors) {
      allErrors.push(`Question[${i}]: ${error}`);
    }

    // Check for duplicate IDs
    if (typeof questions[i] === 'object' && questions[i] !== null) {
      const question = questions[i] as Record<string, unknown>;
      if (typeof question.id === 'string') {
        if (seenIds.has(question.id)) {
          allErrors.push(`Question[${i}]: Duplicate question ID: ${question.id}`);
        }
        seenIds.add(question.id);
      }
    }
  }

  return allErrors;
}

describe('Question Schema Validation', () => {
  describe('validateQuestion', () => {
    it('validates a valid question', () => {
      const validQuestion: import('../src/types').Question = {
        id: 'abc123',
        dom: 'NS',
        diff: 3,
        q: 'What is 2 + 2?',
        opts: ['4', '5', '3', '6'],
        correct: 0,
        why: 'Addition explanation',
        tip: 'Tip here',
        img: undefined,
        tag: undefined
      };
      const errors = validateQuestion(validQuestion);
      expect(errors).toHaveLength(0);
    });

    it('rejects missing required fields', () => {
      const invalidQuestion: Partial<import('../src/types').Question> = {
        id: 'abc',
        dom: 'NS',
        diff: 3 as any
      };
      const errors = validateQuestion(invalidQuestion as import('../src/types').Question);
      expect(errors).toContain('Missing required field: q');
      expect(errors).toContain('Missing required field: opts');
      expect(errors).toContain('Missing required field: correct');
      expect(errors).toContain('Missing required field: why');
      expect(errors).toContain('Missing required field: tip');
    });

    it('rejects invalid domain', () => {
      const invalidQuestion: import('../src/types').Question = {
        id: 'abc123',
        dom: 'INVALID' as unknown as string,
        diff: 3,
        q: 'Test',
        opts: ['a', 'b', 'c', 'd'],
        correct: 0,
        why: '',
        tip: '',
        img: undefined,
        tag: undefined
      };
      const errors = validateQuestion(invalidQuestion);
      expect(errors).toContain('Invalid domain: INVALID. Must be one of NS, RP, EE, G, SP');
    });

    it('rejects invalid difficulty', () => {
      const invalidQuestion: import('../src/types').Question = {
        id: 'abc123',
        dom: 'NS',
        diff: 10 as unknown as number,
        q: 'Test',
        opts: ['a', 'b', 'c', 'd'],
        correct: 0,
        why: '',
        tip: '',
        img: undefined,
        tag: undefined
      };
      const errors = validateQuestion(invalidQuestion);
      expect(errors).toContain('Invalid difficulty: 10. Must be one of 1, 2, 3, 4, 5');
    });

    it('rejects wrong number of options', () => {
      const invalidQuestion: import('../src/types').Question = {
        id: 'abc123',
        dom: 'NS',
        diff: 3,
        q: 'Test',
        opts: ['a', 'b', 'c'] as unknown as string[],
        correct: 0,
        why: '',
        tip: '',
        img: undefined,
        tag: undefined
      };
      const errors = validateQuestion(invalidQuestion);
      expect(errors).toContain('opts must have exactly 4 options, got 3');
    });

    it('rejects incorrect correct index', () => {
      const invalidQuestion: import('../src/types').Question = {
        id: 'abc123',
        dom: 'NS',
        diff: 3,
        q: 'Test',
        opts: ['a', 'b', 'c', 'd'],
        correct: 5 as unknown as number,
        why: '',
        tip: '',
        img: undefined,
        tag: undefined
      };
      const errors = validateQuestion(invalidQuestion);
      expect(errors).toContain('correct must be an integer between 0 and 3, got 5');
    });
  });

  describe('validateQuestionBulk', () => {
    it('validates multiple valid questions', () => {
      const questions: import('../src/types').Question[] = [
        {
          id: 'q1',
          dom: 'NS',
          diff: 3,
          q: 'Q1',
          opts: ['a', 'b', 'c', 'd'],
          correct: 0,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        },
        {
          id: 'q2',
          dom: 'RP',
          diff: 4,
          q: 'Q2',
          opts: ['a', 'b', 'c', 'd'],
          correct: 1,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        },
        {
          id: 'q3',
          dom: 'G',
          diff: 2,
          q: 'Q3',
          opts: ['a', 'b', 'c', 'd'],
          correct: 2,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        }
      ];
      const errors = validateQuestionBulk(questions);
      expect(errors).toHaveLength(0);
    });

    it('returns all errors for multiple invalid questions', () => {
      const questions: import('../src/types').Question[] = [
        {
          id: 'q1',
          dom: 'INVALID' as unknown as string,
          diff: 3,
          q: 'Q1',
          opts: ['a', 'b', 'c', 'd'],
          correct: 0,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        },
        {
          id: 'q2',
          dom: 'NS',
          diff: 10 as unknown as number,
          q: 'Q2',
          opts: ['a', 'b', 'c', 'd'],
          correct: 0,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        }
      ];
      const errors = validateQuestionBulk(questions);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: string) => e.includes('Invalid domain'))).toBe(true);
      expect(errors.some((e: string) => e.includes('Invalid difficulty'))).toBe(true);
    });

    it('detects duplicate IDs in bulk validation', () => {
      const questions: import('../src/types').Question[] = [
        {
          id: 'abc',
          dom: 'NS',
          diff: 3,
          q: 'Q1',
          opts: ['a', 'b', 'c', 'd'],
          correct: 0,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        },
        {
          id: 'abc',
          dom: 'NS',
          diff: 3,
          q: 'Q2',
          opts: ['a', 'b', 'c', 'd'],
          correct: 0,
          why: '',
          tip: '',
          img: undefined,
          tag: undefined
        }
      ];
      const errors = validateQuestionBulk(questions);
      expect(errors).toContain('Question[1]: Duplicate question ID: abc');
    });
  });
});

// Export for use in other tests and CI
export { validateQuestion, validateQuestionBulk };
