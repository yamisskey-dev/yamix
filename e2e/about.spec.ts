import { test, expect } from '@playwright/test';

test.describe('About Page', () => {
  test('should load the about page without authentication', async ({ page }) => {
    // aboutページは認証不要でアクセス可能であるべき
    await page.goto('/main/about');

    // バナー画像が表示されているか確認
    const banner = page.locator('img[alt="Yamix"]');
    await expect(banner).toBeVisible();

    // 「やみっくす」のテキストが表示されているか確認
    await expect(page.getByText('やみっくす')).toBeVisible();
  });

  test('should display key sections', async ({ page }) => {
    await page.goto('/main/about');

    // 世界観と理念セクション
    await expect(page.getByText('世界観と理念')).toBeVisible();
    await expect(page.getByText('不健全な依存関係を解消する')).toBeVisible();

    // エコシステムの仕組みセクション
    await expect(page.getByText('エコシステムの仕組み')).toBeVisible();
    await expect(page.getByText('YAMIトークン経済')).toBeVisible();

    // プライバシーポリシーセクション
    await expect(page.getByText('プライバシーポリシー')).toBeVisible();
  });

  test('should have clickable GitHub links', async ({ page }) => {
    await page.goto('/main/about');

    // GitHubリンクが存在し、正しいURLを持っているか確認
    const yamixLink = page.getByText('ソースコード (Yamix)').locator('..');
    await expect(yamixLink).toHaveAttribute('href', 'https://github.com/yamisskey-dev/yamix');

    const yamiiLink = page.getByText('ソースコード (Yamii)').locator('..');
    await expect(yamiiLink).toHaveAttribute('href', 'https://github.com/yamisskey-dev/yamii');
  });

  test('should display contact information', async ({ page }) => {
    await page.goto('/main/about');

    // 管理者情報
    await expect(page.getByText('YAMI DAO')).toBeVisible();

    // 連絡先
    const emailLink = page.getByText('admin@yami.ski');
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute('href', 'mailto:admin@yami.ski');
  });
});
