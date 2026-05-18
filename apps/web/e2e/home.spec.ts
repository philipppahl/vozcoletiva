import { expect, test } from '@playwright/test';

test('home page renders the brand wordmark and is console-clean', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /vozcoletiva/i })).toBeVisible();
  await expect(page.getByText(/foundation slice/i)).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: /theme/i })).toBeVisible();

  expect(consoleErrors, `Console had errors:\n${consoleErrors.join('\n')}`).toHaveLength(0);
});
