# Contributing to GA4 Tech Issue Catcher

First off, thank you for considering contributing to GA4 Tech Issue Catcher! 🎉

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites
- Node.js 18+ LTS
- Docker Desktop (for local Supabase)
- Supabase CLI v2.58.5+
- Git

### Setup Development Environment

1. **Fork the repository**
   ```bash
   # Click "Fork" button on GitHub
   # Clone your fork
   git clone git@github.com:YOUR_USERNAME/ga4TechIssueCatcher.git
   cd ga4TechIssueCatcher
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream git@github.com:wonyoungseong/ga4TechIssueCatcher.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   npx playwright install chromium
   ```

4. **Setup local Supabase**
   ```bash
   # Install Supabase CLI
   brew install supabase/tap/supabase

   # Start local Supabase
   supabase start

   # Switch to local environment
   ./scripts/switch-to-local.sh

   # Import test data
   node scripts/import-properties-to-local.js
   ```

5. **Verify setup**
   ```bash
   npm test
   npm run test:local-connection
   ```

## Development Workflow

### Creating a New Feature

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

3. **Test your changes**
   ```bash
   npm test
   npm run test:lifecycle
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: Add your feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to GitHub and create a PR from your fork to `main`
   - Fill out the PR template
   - Wait for review

### Fixing a Bug

1. **Create a bugfix branch**
   ```bash
   git checkout -b bugfix/issue-description
   ```

2. **Write a failing test** (if possible)
   - Reproduces the bug
   - Lives in `test/` directory

3. **Fix the bug**
   - Make minimal changes
   - Ensure test passes

4. **Follow commit and PR process** (see above)

## Coding Standards

### JavaScript Style Guide

We use modern ES6+ JavaScript. Follow these conventions:

#### General
- Use `const` and `let`, never `var`
- Use async/await over callbacks
- Use template literals for string interpolation
- Use arrow functions for callbacks
- Maximum line length: 100 characters

#### Naming Conventions
```javascript
// Classes and Constructors: PascalCase
class BrowserPoolManager {}

// Functions and variables: camelCase
function validateMeasurementId() {}
const browserPool = [];

// Constants: UPPER_SNAKE_CASE
const DEFAULT_TIMEOUT = 30000;

// Private methods: prefix with _
_internalMethod() {}

// File names: camelCase.js
// browserPoolManager.js, configValidator.js
```

#### Code Structure
```javascript
// Imports at top
import { createClient } from '@supabase/supabase-js';
import logger from './utils/logger.js';

// Constants
const BROWSER_POOL_SIZE = 7;

// Class definition
class Validator {
  constructor(options) {
    this.options = options;
  }

  async validate() {
    // Implementation
  }
}

// Exports at bottom
export { Validator };
export default Validator;
```

#### Error Handling
```javascript
// Always handle errors
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  throw new ValidationError('Validation failed', { cause: error });
}

// Validate input
function validateProperty(property) {
  if (!property?.url) {
    throw new Error('Property URL is required');
  }
}
```

#### Comments
```javascript
// Use JSDoc for functions
/**
 * Validates GA4 measurement ID for a property
 * @param {string} url - Property URL to validate
 * @param {string} expectedId - Expected measurement ID
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateMeasurementId(url, expectedId) {
  // Implementation
}

// Use inline comments sparingly
// Only when code intent is not obvious
const timeout = 30000; // 30 seconds
```

### Project-Specific Conventions

#### Module Organization
```
src/modules/
├── browserPoolManager.js  # Browser pool management
├── networkEventCapturer.js # CDP network event capture
├── configValidator.js      # GA4/GTM validation logic
└── orchestrator.js         # Main workflow coordination
```

#### GA4/GTM Validation
- Always capture full network events
- Use Chrome DevTools Protocol (CDP)
- Validate against CSV expected values
- Include screenshots for evidence

#### Supabase Integration
- Use batch uploads for efficiency
- Implement proper error handling
- Follow Supabase best practices
- Test with local Supabase first

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples
```bash
# Feature
git commit -m "feat(orchestrator): Add two-phase validation strategy"

# Bug fix
git commit -m "fix(validator): Handle service closed detection"

# Documentation
git commit -m "docs(readme): Update local Supabase setup instructions"

# Multiple changes
git commit -m "feat: Add consent mode support

- Detect Google Consent Mode v2
- Add consent_mode column to database
- Update validation logic
- Add UI display for consent status"
```

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all tests**
   ```bash
   npm test
   npm run test:lifecycle
   ```

3. **Check for lint errors**
   ```bash
   # If lint script exists
   npm run lint
   ```

4. **Update documentation**
   - README.md (if needed)
   - JSDoc comments
   - CHANGELOG.md (for significant changes)

### PR Template Checklist

When creating a PR, ensure you've completed:

- [ ] Filled out PR template completely
- [ ] Added/updated tests
- [ ] Updated documentation
- [ ] Checked code style
- [ ] All tests passing
- [ ] No new warnings
- [ ] Linked related issues

### Review Process

1. **Automated Checks**
   - CI must pass
   - Tests must pass
   - No conflicts with main

2. **Code Review**
   - At least 1 approval required
   - Address all review comments
   - Discuss architectural changes

3. **Merge**
   - Squash and merge for clean history
   - Delete branch after merge

## Testing

### Running Tests

```bash
# All tests
npm test

# Specific test file
node --test test/modules/orchestrator.test.js

# Lifecycle tests
npm run test:lifecycle

# Migration tests
npm run test:full-migration
```

### Writing Tests

```javascript
import { test } from 'node:test';
import assert from 'node:assert';

test('validateMeasurementId should detect mismatches', async (t) => {
  // Arrange
  const validator = new ConfigValidator();
  const property = {
    url: 'https://example.com',
    expectedId: 'G-EXPECTED123'
  };

  // Act
  const result = await validator.validate(property);

  // Assert
  assert.strictEqual(result.isValid, false);
  assert.ok(result.issues.length > 0);
});
```

### Test Coverage

- Aim for >80% code coverage
- Test all critical paths
- Include edge cases
- Mock external services (Supabase, Browser)

## Documentation

### README Updates

- Keep installation steps current
- Add new features to Features section
- Update API documentation
- Include examples

### Code Documentation

```javascript
/**
 * Orchestrates the validation workflow
 *
 * Manages browser pool, property validation, and result storage.
 * Implements two-phase validation strategy for optimal performance.
 *
 * @class Orchestrator
 * @example
 * const orchestrator = new Orchestrator({
 *   browserPoolSize: 7,
 *   timeout: 20000
 * });
 * await orchestrator.run();
 */
class Orchestrator {
  // Implementation
}
```

### Architecture Documentation

- Update `docs/architecture.md` for architectural changes
- Create diagrams for complex flows
- Document decision rationale

## Questions?

If you have questions:
- 📝 [Create an Issue](https://github.com/wonyoungseong/ga4TechIssueCatcher/issues/new?template=question.md)
- 💬 [GitHub Discussions](https://github.com/wonyoungseong/ga4TechIssueCatcher/discussions)

---

Thank you for contributing to GA4 Tech Issue Catcher! 🚀
