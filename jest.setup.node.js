import { beforeAll, afterEach, afterAll } from '@jest/globals'
import { server } from './__tests__/mocks/server'

// Mock Next.js server-side functions
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getAll: jest.fn(() => []),
  })),
  headers: jest.fn(() => ({
    get: jest.fn(),
  })),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock Supabase server client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      overrideTypes: jest.fn().mockReturnThis(),
    })),
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed-url' },
          error: null,
        }),
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
      })),
    },
  })),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Setup MSW for API mocking
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Global test utilities
global.testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstname: 'Test',
  lastname: 'User',
}

global.testEvent = {
  id: 1,
  title: 'Test Event',
  description: 'Test Event Description',
  teaser: 'Test teaser',
  event_date: '2024-12-31T16:00:00Z',
  registration_date: '2024-12-01T12:00:00Z',
  location: 'Test Location',
  food: 'Test Food',
  language: 'Norsk',
  age_restriction: '18+',
  participation_limit: 40,
  event_type: 'internal_event',
  hosting_company: 'test-company-id',
  external_url: null,
}

global.testCompany = {
  id: 'test-company-id',
  name: 'Test Company',
  description: 'Test Company Description',
  logo: 'test-logo-id',
  created_at: '2024-01-01T00:00:00Z',
}

// Suppress console logs during tests unless explicitly testing them
const originalConsole = { ...console }
beforeAll(() => {
  console.log = jest.fn()
  console.info = jest.fn()
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  Object.assign(console, originalConsole)
})