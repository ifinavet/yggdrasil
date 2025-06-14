import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/components/theme-provider'
import { TitleProvider } from '@/contexts/TitleContext'

// Mock user for testing
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstname: 'Test',
  lastname: 'User',
  name: 'Test User',
  initials: 'TU',
  avatar_url: 'https://example.com/avatar.jpg',
}

// Mock event data
export const mockEvent = {
  id: 1,
  title: 'Test Event',
  teaser: 'This is a test event',
  event_date: new Date('2024-12-31T16:00:00Z'),
  registration_date: new Date('2024-12-01T12:00:00Z'),
  company: {
    name: 'Test Company',
    description: 'Test Company Description',
  },
  organizers: [
    {
      id: 1,
      firstname: 'John',
      lastname: 'Doe',
      type: 'Hovedansvarlig',
    },
  ],
}

// Mock company data
export const mockCompany = {
  id: 'company-1',
  name: 'Test Company',
  description: 'Test Company Description',
  logo: 'logo-1',
}

// Mock internal member data
export const mockInternalMember = {
  id: 'member-1',
  firstname: 'John',
  lastname: 'Doe',
  fullname: 'John Doe',
}

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TitleProvider>
        {children}
      </TitleProvider>
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const user = userEvent.setup()
  return {
    user,
    ...render(ui, { wrapper: AllTheProviders, ...options })
  }
}

// Helper to create mock form data
export const createMockFormData = (data: Record<string, string | File>) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

// Helper to create mock file
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg') => {
  return new File(['test'], name, { type })
}

// Helper to wait for loading states
export const waitForLoadingToFinish = () => 
  new Promise(resolve => setTimeout(resolve, 0))

// Helper to mock successful Supabase responses
export const mockSupabaseSuccess = (data: any) => ({
  data,
  error: null,
})

// Helper to mock Supabase errors
export const mockSupabaseError = (message: string, code?: string) => ({
  data: null,
  error: {
    message,
    code: code || 'MOCK_ERROR',
  },
})

// Helper to mock auth user
export const mockAuthUser = (overrides = {}) => ({
  data: {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: {
        firstname: 'Test',
        lastname: 'User',
      },
      ...overrides,
    },
  },
  error: null,
})

// Helper to mock auth error
export const mockAuthError = (message: string) => ({
  data: { user: null },
  error: {
    message,
    status: 401,
  },
})

// Helper to create mock router
export const createMockRouter = (overrides = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  ...overrides,
})

// Helper to create mock form submission
export const mockFormSubmission = (values: any) => {
  const mockSubmit = jest.fn()
  const mockForm = {
    handleSubmit: (onSubmit: (values: any) => void) => (e: Event) => {
      e.preventDefault()
      onSubmit(values)
      mockSubmit(values)
    },
    getValues: jest.fn(() => values),
    setValue: jest.fn(),
    control: {},
    formState: {
      errors: {},
      isSubmitting: false,
      isValid: true,
    },
  }
  return { mockForm, mockSubmit }
}

// Helper to create mock date
export const createMockDate = (dateString: string) => {
  const date = new Date(dateString)
  return date
}

// Helper to simulate async operations
export const simulateAsyncOperation = (delay = 100) =>
  new Promise(resolve => setTimeout(resolve, delay))

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { customRender as render }
export { userEvent }