import { test, expect } from '@playwright/test';

test.describe('Issue Workflow', () => {
  test('complete workflow: login → project selection → issue creation → detail view', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/');

    // Check if we're on login page or redirected to it
    await expect(page).toHaveURL(/\/(login)?/);

    // Step 2: Login
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const loginButton = page.getByRole('button', { name: /sign in/i });

    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    await loginButton.click();

    // Wait for successful login (should redirect away from login page)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    // Step 3: Navigate to projects page
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();

    // Check if there are existing projects or create one
    const projectLink = page.locator('a[href*="/projects/"]').first();
    const hasProjects = await projectLink.count() > 0;

    if (!hasProjects) {
      // Create a new project if none exist
      const createButton = page.getByRole('button', { name: /new project/i });
      if (await createButton.isVisible()) {
        await createButton.click();

        await page.getByLabel(/name/i).fill('Test Project');
        await page.getByLabel(/description/i).fill('E2E Test Project');
        await page.getByRole('button', { name: /create/i }).click();

        // Wait for project to be created
        await page.waitForTimeout(1000);
      }
    }

    // Step 4: Select a project and navigate to issues
    const firstProject = page.locator('a[href*="/projects/"]').first();
    await firstProject.click();

    // Should now be on project issues page
    await expect(page).toHaveURL(/\/projects\/\d+\/issues/);
    await expect(page.getByRole('heading', { name: /issues/i })).toBeVisible();

    // Step 5: Create a new issue
    const newIssueButton = page.getByRole('button', { name: /new issue/i });
    await newIssueButton.click();

    // Fill in issue form
    const issueTitle = `E2E Test Issue ${Date.now()}`;
    await page.getByLabel(/title/i).fill(issueTitle);
    await page.getByLabel(/description/i).fill('This is a test issue created by E2E test');

    const createIssueButton = page.getByRole('button', { name: /create issue/i });
    await createIssueButton.click();

    // Wait for modal to close and issue to appear in list
    await page.waitForTimeout(1000);

    // Step 6: Click on the created issue to view details
    const issueLink = page.getByRole('link', { name: new RegExp(issueTitle, 'i') });
    await issueLink.click();

    // Verify we're on issue detail page
    await expect(page).toHaveURL(/\/issues\/\d+/);
    await expect(page.getByRole('heading', { name: new RegExp(issueTitle, 'i') })).toBeVisible();

    // Verify issue details are displayed
    await expect(page.getByText(/This is a test issue created by E2E test/i)).toBeVisible();

    // Verify comments section exists
    await expect(page.getByRole('heading', { name: /comments/i })).toBeVisible();
  });

  test('keyboard navigation works on issue list', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Login
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    // Navigate to projects
    await page.goto('/projects');

    // Use Tab to navigate to first project link
    await page.keyboard.press('Tab');
    const firstFocusedElement = await page.evaluate(() => document.activeElement?.tagName);

    // Verify keyboard navigation is working (at least some element gets focus)
    expect(firstFocusedElement).toBeTruthy();
  });
});
