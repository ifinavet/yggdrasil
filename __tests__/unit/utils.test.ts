import { encodedRedirect } from '@/utils/utils'
import { cn } from '@/lib/utils'

// Mock Next.js redirect
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

describe('Utility Functions', () => {
  describe('encodedRedirect', () => {
    const mockRedirect = jest.requireMock('next/navigation').redirect

    beforeEach(() => {
      mockRedirect.mockClear()
    })

    it('should redirect with encoded success message', () => {
      const path = '/test-path'
      const message = 'Success message'
      
      expect(() => encodedRedirect('success', path, message)).toThrow()
      expect(mockRedirect).toHaveBeenCalledWith(
        `${path}?success=${encodeURIComponent(message)}`
      )
    })

    it('should redirect with encoded error message', () => {
      const path = '/error-path'
      const message = 'Error message'
      
      expect(() => encodedRedirect('error', path, message)).toThrow()
      expect(mockRedirect).toHaveBeenCalledWith(
        `${path}?error=${encodeURIComponent(message)}`
      )
    })

    it('should properly encode special characters in message', () => {
      const path = '/test'
      const message = 'Message with spaces & special chars!'
      
      expect(() => encodedRedirect('success', path, message)).toThrow()
      expect(mockRedirect).toHaveBeenCalledWith(
        `${path}?success=${encodeURIComponent(message)}`
      )
    })

    it('should handle empty messages', () => {
      const path = '/test'
      const message = ''
      
      expect(() => encodedRedirect('error', path, message)).toThrow()
      expect(mockRedirect).toHaveBeenCalledWith(
        `${path}?error=`
      )
    })
  })

  describe('cn (className utility)', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2')
      expect(result).toBe('class1 class2')
    })

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'conditional', false && 'hidden')
      expect(result).toBe('base conditional')
    })

    it('should merge Tailwind classes correctly', () => {
      const result = cn('p-2 p-4', 'text-red-500 text-blue-500')
      // Should prioritize later classes
      expect(result).toContain('p-4')
      expect(result).toContain('text-blue-500')
    })

    it('should handle undefined and null values', () => {
      const result = cn('base', undefined, null, 'valid')
      expect(result).toBe('base valid')
    })

    it('should handle empty strings', () => {
      const result = cn('', 'valid', '')
      expect(result).toBe('valid')
    })

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    it('should handle objects with boolean values', () => {
      const result = cn({
        'class1': true,
        'class2': false,
        'class3': true,
      })
      expect(result).toBe('class1 class3')
    })
  })
})