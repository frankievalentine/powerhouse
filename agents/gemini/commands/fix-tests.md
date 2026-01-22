---
description: Fix failing tests and improve test coverage
---

Analyze and fix test failures in the project.

## Steps

1. First, run tests to see current status:

```
npm test
```

2. If there are failures, analyze each one:
   - Read the error message carefully
   - Find the failing test file
   - Understand what the test is checking
   - Find the source code being tested
   - Identify the root cause

3. Fix the issues:
   - Update source code if it's a bug
   - Update test if expectations are wrong
   - Add missing mock data if needed

4. Run tests again to verify fixes:

```
npm test
```

5. Check coverage:

```
npm test -- --coverage
```

6. If coverage is low in critical areas, add more tests following the test-coverage workflow.
