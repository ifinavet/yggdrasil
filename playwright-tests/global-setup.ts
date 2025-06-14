import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Wait for the application to be ready
    console.log('Waiting for application to be ready...')
    await page.goto(baseURL || 'http://127.0.0.1:3000')
    await page.waitForLoadState('networkidle')
    
    // Check if the app is responding
    await page.locator('body').waitFor({ timeout: 30000 })
    console.log('Application is ready for testing')

    // Set up test user if needed
    await setupTestUser(page, baseURL)

  } catch (error) {
    console.error('Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

async function setupTestUser(page: any, baseURL?: string) {
  try {
    // Navigate to sign up page
    await page.goto(`${baseURL}/sign-up`)
    
    // Check if test user already exists by trying to sign in
    await page.goto(`${baseURL}/sign-in`)
    await page.fill('input[name="email"]', 'test@playwright.com')
    await page.fill('input[name="password"]', 'testpassword123')
    
    const signInButton = page.locator('button[type="submit"]')
    await signInButton.click()
    
    // If sign in fails, create the test user
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    
    if (currentUrl.includes('/sign-in')) {
      console.log('Creating test user...')
      await page.goto(`${baseURL}/sign-up`)
      await page.fill('input[name="email"]', 'test@playwright.com')
      await page.fill('input[name="password"]', 'testpassword123')
      
      const signUpButton = page.locator('button[type="submit"]')
      await signUpButton.click()
      
      console.log('Test user created successfully')
    } else {
      console.log('Test user already exists')
    }
    
    // Sign out to clean state
    if (currentUrl.includes('/protected') || currentUrl.includes('/bifrost')) {
      await page.goto(`${baseURL}/`)
    }
    
  } catch (error) {
    console.log('Test user setup skipped:', error.message)
  }
}

export default globalSetup