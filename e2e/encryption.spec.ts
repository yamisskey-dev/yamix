import { test, expect } from '@playwright/test';

/**
 * E2E Core Tests
 *
 * UI詳細に依存しない、アプリケーションの基本機能をテスト：
 * - サーバー起動確認
 * - ヘルスチェック
 * - 基本的なページロード
 * - 暗号化機能の基本動作
 */

test.describe('Core Functionality', () => {
  test('health check endpoint should return 200', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('home page should load without errors', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();

    // ページにエラーメッセージがないことを確認
    const errorText = await page.locator('body').textContent();
    expect(errorText).not.toContain('Application error');
    expect(errorText).not.toContain('500 Internal Server Error');
  });

  test('about page should load without errors', async ({ page }) => {
    const response = await page.goto('/main/about');
    expect(response?.ok()).toBeTruthy();

    // ページにエラーメッセージがないことを確認
    const errorText = await page.locator('body').textContent();
    expect(errorText).not.toContain('Application error');
    expect(errorText).not.toContain('500 Internal Server Error');
  });
});
