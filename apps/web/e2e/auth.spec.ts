import { expect, test } from '@playwright/test';

test('sign-in page renders and validates inputs', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/sign-in');

  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  // Exact match: the field also has a "Show password" reveal toggle (Field.tsx),
  // which would otherwise make /password/i ambiguous.
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

  // Submitting an empty form surfaces field-level errors (HTML5 + RHF/Zod).
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/please enter a valid email/i)).toBeVisible();

  expect(consoleErrors, `Console had errors:\n${consoleErrors.join('\n')}`).toHaveLength(0);
});

test('sign-up page renders and validates inputs', async ({ page }) => {
  await page.goto('/sign-up');

  await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  await expect(page.getByLabel(/display name/i)).toBeVisible();

  // Continue is gated until the form is complete, including an available
  // @handle (decision 0030) — so an empty form keeps it disabled.
  await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled();
});
