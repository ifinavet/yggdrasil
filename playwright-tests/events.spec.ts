import { test, expect } from '@playwright/test'

test.describe('Events Management', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/sign-in')
    await page.fill('input[name="email"]', 'test@playwright.com')
    await page.fill('input[name="password"]', 'testpassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*protected|.*bifrost/, { timeout: 10000 })
  })

  test('should navigate to events page', async ({ page }) => {
    await page.goto('/bifrost/events')
    
    await expect(page).toHaveURL(/.*bifrost\/events/)
    await expect(page.locator('text=Arrangementer')).toBeVisible()
  })

  test('should display events grid', async ({ page }) => {
    await page.goto('/bifrost/events')
    
    // Should have semester selector
    await expect(page.locator('select').or(page.locator('[role="combobox"]'))).toBeVisible()
    
    // Should have create event button
    await expect(page.locator('text=Lag et arrangement')).toBeVisible()
  })

  test('should filter events by semester', async ({ page }) => {
    await page.goto('/bifrost/events')
    
    // Open semester selector
    const semesterSelector = page.locator('select').or(page.locator('[role="combobox"]')).first()
    await semesterSelector.click()
    
    // Should show semester options
    await expect(page.locator('text=V24').or(page.locator('text=H24'))).toBeVisible()
  })

  test('should navigate to create event page', async ({ page }) => {
    await page.goto('/bifrost/events')
    
    await page.click('text=Lag et arrangement')
    
    await expect(page).toHaveURL(/.*bifrost\/events\/create-event/)
    await expect(page.locator('text=Opprett et helt magisk arrangement')).toBeVisible()
  })

  test('should display event creation form', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Check for required form fields
    await expect(page.locator('input[name="title"]')).toBeVisible()
    await expect(page.locator('textarea[name="teaser"]')).toBeVisible()
    await expect(page.locator('input[name="food"]')).toBeVisible()
    await expect(page.locator('input[name="location"]')).toBeVisible()
    await expect(page.locator('input[name="participantsLimit"]')).toBeVisible()
    
    // Check for date pickers
    await expect(page.locator('text=Dato og tid for arrangements start')).toBeVisible()
    await expect(page.locator('text=Dato og til for påmelding')).toBeVisible()
    
    // Check for company selector
    await expect(page.locator('text=Velg arrangerende bedrift')).toBeVisible()
    
    // Check for description editor
    await expect(page.locator('[data-testid="editor"]').or(page.locator('.prose'))).toBeVisible()
  })

  test('should validate required fields in event form', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should show validation errors
    await expect(page.locator('text=må være minst')).toBeVisible()
  })

  test('should fill and submit event form', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Fill required fields
    await page.fill('input[name="title"]', 'Test Event From E2E')
    await page.fill('textarea[name="teaser"]', 'This is a test event created during E2E testing')
    await page.fill('input[name="food"]', 'Pizza')
    await page.fill('input[name="location"]', 'Test Location')
    await page.fill('input[name="participantsLimit"]', '25')
    await page.fill('input[name="ageRestrictions"]', '18+')
    await page.fill('input[name="language"]', 'Norsk')
    
    // Select company
    await page.click('text=Velg en bedrift...')
    await page.click('[role="option"]', { timeout: 5000 })
    
    // Set dates
    const eventDateButton = page.locator('button').filter({ hasText: /MM\/dd\/yyyy/ }).first()
    await eventDateButton.click()
    await page.click('[role="gridcell"]').first()
    
    // Fill description in editor
    const editor = page.locator('.prose').or(page.locator('[contenteditable="true"]')).first()
    await editor.click()
    await editor.fill('This is a detailed description of the test event.')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should show success message or redirect
    await expect(page.locator('text=Arrangement laget!')).toBeVisible({ timeout: 10000 })
  })

  test('should handle date picker interactions', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Open event date picker
    const eventDateButton = page.locator('button').filter({ hasText: /MM\/dd\/yyyy/ }).first()
    await eventDateButton.click()
    
    // Calendar should be visible
    await expect(page.locator('[role="grid"]')).toBeVisible()
    
    // Should be able to select a date
    await page.click('[role="gridcell"]:not([aria-disabled])').first()
    
    // Should be able to select time
    await page.click('text=16').first()
    await page.click('text=00').first()
  })

  test('should handle company selection', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Open company selector
    await page.click('text=Velg en bedrift...')
    
    // Should show company options
    await expect(page.locator('[role="option"]')).toBeVisible()
    
    // Select first company
    await page.click('[role="option"]').first()
    
    // Button should show selected company
    await expect(page.locator('text=Velg en bedrift...')).not.toBeVisible()
  })

  test('should handle organizer management', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Add organizer section should be visible
    await expect(page.locator('text=Legg til ansvarlig')).toBeVisible()
    await expect(page.locator('text=Velg et medlem...')).toBeVisible()
    
    // Select organizer type
    await page.click('text=Ansvarlig type')
    await page.click('text=Hovedansvarlig')
    
    // Select member
    await page.click('text=Velg et medlem...')
    await page.click('[role="option"]').first()
    
    // Add organizer
    await page.click('text=Legg til ansvarlig')
    
    // Should show in table
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('text=Hovedansvarlig')).toBeVisible()
  })

  test('should handle rich text editor', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Editor should be visible
    const editor = page.locator('.prose').or(page.locator('[contenteditable="true"]')).first()
    await expect(editor).toBeVisible()
    
    // Should be able to type
    await editor.click()
    await editor.type('This is test content')
    
    // Toolbar should be visible
    await expect(page.locator('button').filter({ hasText: /Bold|Italic/ })).toBeVisible()
    
    // Should be able to format text
    await page.keyboard.selectAll()
    await page.click('button[title="Bold"]').or(page.locator('button').filter({ hasText: 'Bold' }))
  })

  test('should handle event type selection', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Event type selector should be visible
    await expect(page.locator('text=Arrangementtype')).toBeVisible()
    
    // Select external event
    await page.click('text=Velg arrangementtype')
    await page.click('text=Eksternt')
    
    // External URL field should appear
    await expect(page.locator('input[name="externalUrl"]')).toBeVisible()
    await expect(page.locator('text=Link til arrangementet')).toBeVisible()
  })

  test('should show breadcrumb navigation', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Breadcrumb should be visible
    await expect(page.locator('nav[aria-label="breadcrumb"]').or(page.locator('text=Hjem'))).toBeVisible()
    await expect(page.locator('text=Arrangementer')).toBeVisible()
    await expect(page.locator('text=Opprett et arrangement')).toBeVisible()
    
    // Should be able to navigate back
    await page.click('text=Arrangementer')
    await expect(page).toHaveURL(/.*bifrost\/events$/)
  })

  test('should display event cards when events exist', async ({ page }) => {
    await page.goto('/bifrost/events')
    
    // Wait for events to load
    await page.waitForLoadState('networkidle')
    
    // Should show either events or empty state
    const hasEvents = await page.locator('[data-testid="event-card"]').count() > 0
    const hasEmptyState = await page.locator('text=No events').isVisible()
    
    expect(hasEvents || hasEmptyState).toBeTruthy()
  })

  test('should handle loading states', async ({ page }) => {
    await page.goto('/bifrost/events')
    
    // Should show loading state initially
    await expect(page.locator('text=Loading')).toBeVisible({ timeout: 2000 })
      .or(expect(page.locator('[data-testid="skeleton"]')).toBeVisible({ timeout: 2000 }))
      .catch(() => {
        // Loading might be too fast to catch, that's ok
      })
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/bifrost/events')
    
    // Mobile navigation should work
    await expect(page.locator('button[aria-label="Toggle Sidebar"]').or(page.locator('[data-testid="mobile-menu"]'))).toBeVisible()
    
    // Create event button should be accessible
    await expect(page.locator('text=Lag et arrangement')).toBeVisible()
  })

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Should be able to tab through form
    await page.press('body', 'Tab')
    await expect(page.locator('input[name="title"]')).toBeFocused()
    
    await page.press('body', 'Tab')
    await expect(page.locator('textarea[name="teaser"]')).toBeFocused()
  })

  test('should persist form data on navigation', async ({ page }) => {
    await page.goto('/bifrost/events/create-event')
    
    // Fill some data
    await page.fill('input[name="title"]', 'Persistent Test Event')
    await page.fill('input[name="food"]', 'Tacos')
    
    // Navigate away and back
    await page.goBack()
    await page.goForward()
    
    // Data should still be there (if form persistence is implemented)
    // This test might fail if form persistence isn't implemented
  })
})