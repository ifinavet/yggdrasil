# Testing Guide for Navet (Yggdrasil)

This document provides comprehensive information about the testing setup and guidelines for the Navet project.

## Testing Stack

- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **Playwright** - End-to-end testing
- **MSW (Mock Service Worker)** - API mocking
- **Supabase Test Utilities** - Database testing helpers

## Directory Structure

```
__tests__/
├── unit/                    # Unit tests
│   ├── components/         # React component tests
│   └── utils.test.ts       # Utility function tests
├── integration/            # Integration tests
│   └── api/               # API route tests
├── database/              # Database integration tests
├── utils/                 # Test utility functions
├── helpers/               # Test helper functions
│   ├── test-utils.tsx     # React Testing Library setup
│   └── db-utils.ts        # Database testing utilities
└── mocks/                 # Mock implementations
    ├── handlers.ts        # MSW request handlers
    └── server.ts          # MSW server setup

playwright-tests/          # E2E tests
├── auth.spec.ts           # Authentication flow tests
├── events.spec.ts         # Events functionality tests
├── global-setup.ts        # Global test setup
└── global-teardown.ts     # Global test cleanup
```

## Available Scripts

```bash
# Run all Jest tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run database tests
npm run test:db

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests (Jest + Playwright)
npm run test:all
```

## Writing Tests

### Unit Tests

Unit tests should focus on testing individual components or functions in isolation.

```typescript
// Example component test
import { render, screen } from '../helpers/test-utils'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

```typescript
// Example API integration test
import { createTestEvent, cleanupTestData } from '../helpers/db-utils'

describe('Events API', () => {
  afterEach(async () => {
    await cleanupTestData()
  })

  it('should create an event', async () => {
    const event = await createTestEvent({
      title: 'Test Event'
    })
    expect(event.id).toBeDefined()
  })
})
```

### Database Tests

Database tests verify data persistence and relationships.

```typescript
import { 
  createTestClient, 
  expectDatabaseToContain 
} from '../helpers/db-utils'

describe('Event Database', () => {
  it('should store event data correctly', async () => {
    const supabase = createTestClient()
    const { data } = await supabase
      .from('event')
      .insert({ title: 'Test Event' })
      .select()
      .single()

    await expectDatabaseToContain('event', { 
      id: data.id 
    })
  })
})
```

### E2E Tests

End-to-end tests verify complete user workflows.

```typescript
import { test, expect } from '@playwright/test'

test('user can create an event', async ({ page }) => {
  await page.goto('/sign-in')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')
  
  await page.goto('/bifrost/events/create-event')
  await page.fill('input[name="title"]', 'E2E Test Event')
  await page.click('button[type="submit"]')
  
  await expect(page.locator('text=Event created')).toBeVisible()
})
```

## Test Utilities

### Custom Render Function

Use the custom render function for component tests:

```typescript
import { render, screen, userEvent } from '../helpers/test-utils'

// Automatically includes providers (Theme, Title, etc.)
const { user } = render(<MyComponent />)
await user.click(screen.getByRole('button'))
```

### Mock Data

Use predefined mock data for consistent testing:

```typescript
import { mockUser, mockEvent, mockCompany } from '../helpers/test-utils'

// Use in tests
render(<EventCard event={mockEvent} />)
```

### Database Helpers

Use database helpers for integration tests:

```typescript
import { 
  createTestUser,
  createTestEvent,
  cleanupTestData 
} from '../helpers/db-utils'

// Create test data
const user = await createTestUser()
const event = await createTestEvent({ 
  hosting_company: company.id 
})

// Cleanup after tests
await cleanupTestData()
```

## Mocking

### Supabase Client

Supabase is automatically mocked in test environments. You can override the mock behavior:

```typescript
const mockSupabase = jest.requireMock('@/utils/supabase/client')
mockSupabase.createClient.mockReturnValue({
  from: jest.fn(() => ({
    select: jest.fn().mockResolvedValue({ 
      data: [mockEvent], 
      error: null 
    })
  }))
})
```

### Next.js Router

Router functions are mocked automatically:

```typescript
const mockPush = jest.requireMock('next/navigation').useRouter().push
expect(mockPush).toHaveBeenCalledWith('/expected-path')
```

### API Requests

MSW handles API mocking. Add new handlers in `mocks/handlers.ts`:

```typescript
http.get('/api/new-endpoint', () => {
  return HttpResponse.json({ data: 'mocked response' })
})
```

## Environment Setup

### Test Database

For database tests, ensure you have a test database configured:

```env
NEXT_PUBLIC_SUPABASE_URL=your-test-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key
```

### Environment Variables

Test environment variables are mocked in `jest.setup.node.js`.

## Coverage Requirements

The project enforces minimum coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Run `npm run test:coverage` to see coverage reports.

## CI/CD Integration

Tests run automatically in CI/CD pipelines:

- Unit and integration tests run on every commit
- E2E tests run on pull requests to main branch
- Coverage reports are generated and tracked

## Best Practices

### Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow the Arrange-Act-Assert pattern

### Test Data

- Use factory functions for creating test data
- Clean up test data after each test
- Avoid hard-coding test data values

### Async Testing

- Always await async operations
- Use appropriate timeouts for E2E tests
- Handle loading states in component tests

### Accessibility

- Test with screen readers in mind
- Use semantic queries (getByRole, getByLabelText)
- Verify ARIA attributes where applicable

## Debugging Tests

### Jest Tests

```bash
# Debug specific test
npm run test -- --testNamePattern="specific test name"

# Run tests with verbose output
npm run test -- --verbose

# Run tests without coverage
npm run test -- --coverage=false
```

### Playwright Tests

```bash
# Run in debug mode
npm run test:e2e -- --debug

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npm run test:e2e -- events.spec.ts
```

## Common Issues

### Test Timeouts

If tests are timing out, increase timeouts in configuration files or use `waitFor` utilities.

### Mock Issues

Clear mocks between tests using `jest.clearAllMocks()` in `beforeEach` hooks.

### Database Cleanup

Ensure `cleanupTestData()` is called in `afterEach` for database tests to prevent test pollution.

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [MSW Documentation](https://mswjs.io/docs/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/local-development)