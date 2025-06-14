import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should redirect unauthenticated user to sign-in', async ({ page }) => {
    await page.goto('/bifrost')
    await expect(page).toHaveURL(/.*sign-in/)
  })

  test('should allow user to sign up', async ({ page }) => {
    await page.goto('/sign-up')
    
    await expect(page.locator('h1')).toContainText('Sign up')
    
    const email = `test${Date.now()}@example.com`
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', 'password123')
    
    await page.click('button[type="submit"]')
    
    // Should show success message or redirect
    await expect(page.locator('text=check your email', { timeout: 10000 })).toBeVisible()
  })

  test('should allow user to sign in', async ({ page }) => {
    await page.goto('/sign-in')
    
    await expect(page.locator('h1')).toContainText('Sign in')
    
    await page.fill('input[name="email"]', 'test@playwright.com')
    await page.fill('input[name="password"]', 'testpassword123')
    
    await page.click('button[type="submit"]')
    
    // Should redirect to protected area
    await expect(page).toHaveURL(/.*protected|.*bifrost/)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/sign-in')
    
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('text=Invalid', { timeout: 5000 })).toBeVisible()
  })

  test('should navigate to forgot password', async ({ page }) => {
    await page.goto('/sign-in')
    
    await page.click('text=Forgot Password?')
    
    await expect(page).toHaveURL(/.*forgot-password/)
    await expect(page.locator('h1')).toContainText('Reset Password')
  })

  test('should allow password reset request', async ({ page }) => {
    await page.goto('/forgot-password')
    
    await page.fill('input[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')
    
    // Should show success message
    await expect(page.locator('text=Check your email', { timeout: 5000 })).toBeVisible()
  })

  test('should navigate between sign-in and sign-up', async ({ page }) => {
    await page.goto('/sign-in')
    
    await page.click('text=Sign up')
    await expect(page).toHaveURL(/.*sign-up/)
    
    await page.click('text=Sign in')
    await expect(page).toHaveURL(/.*sign-in/)
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/sign-in')
    
    // Try to submit without filling fields
    await page.click('button[type="submit"]')
    
    // Should show HTML5 validation or custom validation
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toHaveAttribute('required')
    
    const passwordInput = page.locator('input[name="password"]')
    await expect(passwordInput).toHaveAttribute('required')
  })

  test('should handle form submission states', async ({ page }) => {
    await page.goto('/sign-in')
    
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    
    // Check submit button state
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeEnabled()
    
    await submitButton.click()
    
    // Button should show loading state or be disabled
    await expect(submitButton).toHaveText(/Signing In|Loading/, { timeout: 2000 })
  })

  test('should redirect authenticated user from auth pages', async ({ page }) => {
    // First sign in
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'test@playwright.com')
    await page.fill('input[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect
    await page.waitForURL(/.*protected|.*bifrost/, { timeout: 10000 })
    
    // Try to access sign-in page again
    await page.goto('/sign-in')
    
    // Should redirect away from sign-in
    await expect(page).not.toHaveURL(/.*sign-in/)
  })

  test('should sign out user', async ({ page }) => {
    // First sign in
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'test@playwright.com')
    await page.fill('input[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/.*protected|.*bifrost/, { timeout: 10000 })
    
    // Find and click logout
    const logoutButton = page.locator('text=Log out').or(page.locator('text=Sign out'))
    await logoutButton.click()
    
    // Should redirect to home page
    await expect(page).toHaveURL('/')
  })

  test('should maintain session across page refreshes', async ({ page }) => {
    // Sign in
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'test@playwright.com')
    await page.fill('input[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/.*protected|.*bifrost/, { timeout: 10000 })
    
    // Refresh the page
    await page.reload()
    
    // Should still be authenticated
    await expect(page).not.toHaveURL(/.*sign-in/)
  })

  test('should handle email validation', async ({ page }) => {
    await page.goto('/sign-up')
    
    // Try invalid email
    await page.fill('input[name="email"]', 'invalid-email')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Should show validation error
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toHaveAttribute('type', 'email')
  })

  test('should handle password requirements', async ({ page }) => {
    await page.goto('/sign-up')
    
    await page.fill('input[name="email"]', 'test@example.com')
    
    // Try short password
    await page.fill('input[name="password"]', '123')
    
    const passwordInput = page.locator('input[name="password"]')
    await expect(passwordInput).toHaveAttribute('minlength', '6')
  })

  test('should show loading states during authentication', async ({ page }) => {
    await page.goto('/sign-in')
    
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    
    const submitButton = page.locator('button[type="submit"]')
    
    // Click and immediately check for loading state
    await submitButton.click()
    
    // Should show some loading indication
    await expect(submitButton).toHaveAttribute('aria-disabled', 'true', { timeout: 1000 })
      .or(expect(submitButton).toHaveText(/Signing In|Loading/, { timeout: 1000 }))
  })
})