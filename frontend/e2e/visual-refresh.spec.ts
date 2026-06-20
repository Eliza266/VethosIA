import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'e2e-screenshots', 'visual-refresh');

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test.describe('Capturas visual refresh (login público)', () => {
  test('login desktop 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, '01-login-desktop-1440.png'), fullPage: true });
  });

  test('login mobile 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, '02-login-mobile-390.png'), fullPage: true });
  });
});
