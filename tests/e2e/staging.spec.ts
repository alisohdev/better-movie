import { test, expect } from '@playwright/test';

for (const locale of ['en', 'fa']) {
  const fa = locale === 'fa';
  test(`${locale}: TMDB staging source, missing Persian fallback, aliases, history and revision rejection`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const health = await (await request.get('/api/health')).json();
    const revision = health.catalogRevision as string;
    expect(revision).toMatch(/^tmdb-[a-f0-9]{64}$/);
    expect((await request.get('/api/movies?v=1', { headers: { 'X-Catalog-Revision': 'synthetic-v1' } })).status()).toBe(409);
    expect((await request.get('/api/movies?v=1')).status()).toBe(409);
    const result = await (await request.get('/api/movies?v=1', { headers: { 'X-Catalog-Revision': revision } })).json();
    expect(result.total).toBe(13); expect(result.items).toHaveLength(12);
    expect(result.items.every((m: { source: string; synthetic: boolean }) => m.source === 'TMDB' && !m.synthetic)).toBe(true);
    await page.goto(`/${locale}/discover/`);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('dir', fa ? 'rtl' : 'ltr');
    await expect(page.locator('.catalog-notice')).toContainText('TMDB');
    await expect(page.getByTestId('movie-card')).toHaveCount(12);
    await expect(page.getByTestId('movie-card').first()).toContainText('Audit Feature 01');
    await expect(page.getByTestId('movie-card').first().locator('img')).toHaveAttribute('src', '/posters/placeholder.svg');
    await page.getByTestId('movie-card').first().getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Audit Feature 01');
    await expect(page.locator('.detail-score')).toContainText('TMDB');
    await expect(page.locator('.synopsis')).toContainText(fa ? 'درج نشده' : 'not included');
    await expect(page.locator('.source-line').filter({ hasText: 'TMDB' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goBack();
    const input = page.getByRole('combobox', { name: fa ? 'جست‌وجوی عنوان فیلم' : 'Search movie titles' });
    await input.fill('FixtureAlias 13');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
    await input.press('ArrowDown'); await input.press('Enter');
    await expect(page).toHaveURL(/tmdb-900000112/);
    await page.goBack();
    await page.locator('.recipe').first().click();
    await expect(page).toHaveURL(/v=1&runtimeMax=100/);
    await expect(page.getByTestId('results')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('movie-card')).toHaveCount(11);
    const selected = page.url();
    await page.getByRole('link', { name: fa ? 'Switch to English' : 'Switch to Persian', exact: true }).click();
    await expect(page).toHaveURL(selected.replace(`/${locale}/`, `/${fa ? 'en' : 'fa'}/`));
    await expect(page.getByTestId('movie-card')).toHaveCount(11);
    await page.goto(`/${locale}/credits/`);
    await expect(page.locator('main')).toContainText('This product uses the TMDB API but is not endorsed or certified by TMDB.');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
