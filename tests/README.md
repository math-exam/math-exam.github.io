# MathPath Tests

Unit and integration tests for the MathPath application.

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

## Test Files

| File | Tests |
|------|-------|
| `engine.test.ts` | `shuffle` and `newId` utility functions |
| `engine-class.test.ts` | `Engine` class (question selection, domain lookup) |
| `question-validation.test.ts` | Schema validation for generated questions |
| `store-types.test.ts` | File constants and status types |
| `store-write-queue.test.ts` | WriteQueue functionality |
| `auth.test.ts` | Authentication token handling |
| `config.test.ts` | Configuration values |
| `ui.test.ts` | UI utility functions |

## Auto-Update Safety

The `question-validation.test.ts` contains schema validation functions that should be used to validate any generated questions file:

```typescript
import { validateQuestion, validateQuestionBulk } from './question-validation.test';

// Validate single question
const errors = validateQuestion(question);
if (errors.length > 0) {
  console.error('Invalid question:', errors);
}

// Validate multiple questions
const bulkErrors = validateQuestionBulk(questions);
```

This ensures that automatic code updates don't break the question data contract.
