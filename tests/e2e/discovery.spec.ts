import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

const pageSchema = z.object({
  items: z.array(z.object({ id: z.string(), titleEn: z.string(), genres: z.array(z.string()), runtime: z.number().nullable() })),
  total: z.number(),
});

async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: /^Your preferences/ });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

test('public HTML contains film content before hydration and uses the requested direction', async ({ request, page }) => {
  const html = await (await request.get('/en/movies/the-space-between/')).text();
  expect(html).toContain('The Space Between');
  expect(html).toContain('noindex');
  await page.goto('/fa/discover/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Persian filtering validates ranges and preserves constraints when switching to English', async ({ page }) => {
  await page.goto('/fa/discover/');
  const toggle = page.getByRole('button', { name: /^سلیقه/ });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await page.getByLabel('حداقل زمان فیلم', { exact: true }).fill('200');
  await page.getByLabel('حداکثر زمان فیلم', { exact: true }).fill('110');
  await page.getByRole('button', { name: 'اعمال بازه‌ها' }).click();
  await expect(page.getByRole('alert')).toContainText('حداقل زمان فیلم نباید از حداکثر زمان فیلم بیشتر باشد.');
  await expect(page.getByRole('alert')).not.toContainText(/[A-Za-z]/);
  await page.getByLabel('حداقل زمان فیلم', { exact: true }).fill('80');
  const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/movies' && new URL(result.url()).searchParams.get('runtimeMin') === '80');
  await page.getByRole('button', { name: 'اعمال بازه‌ها' }).click();
  const payload = pageSchema.parse(await (await response).json());
  expect(payload.items.length).toBeGreaterThan(0);
  expect(payload.items.every((movie) => movie.runtime !== null && movie.runtime >= 80 && movie.runtime <= 110)).toBe(true);
  await expect(page.getByTestId('movie-card')).toHaveCount(payload.items.length);
  await page.getByRole('link', { name: 'Switch to English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/discover\/\?v=1&runtimeMin=80&runtimeMax=110/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await openFilters(page);
  await expect(page.getByLabel('Runtime minimum', { exact: true })).toHaveValue('80');
  await expect(page.getByLabel('Runtime maximum', { exact: true })).toHaveValue('110');
});

test('included and excluded genres use SQL results without replacing the document', async ({ page }) => {
  await page.goto('/en/discover/');
  await openFilters(page);
  await page.evaluate(() => { document.documentElement.dataset.testDocument = 'same-document'; });
  const included = page.waitForResponse((response) => response.url().includes('/api/movies?') && new URL(response.url()).searchParams.get('genres') === 'drama');
  await page.getByLabel('Include Drama', { exact: true }).click();
  await included;
  await page.locator('summary').filter({ hasText: 'Leave something out' }).click();
  const excluded = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/movies' && new URL(response.url()).searchParams.get('excludeGenres') === 'horror');
  await page.getByLabel('Exclude Horror', { exact: true }).click();
  const payload = pageSchema.parse(await (await excluded).json());
  expect(payload.items.length).toBeGreaterThan(0);
  expect(payload.items.every((movie) => movie.genres.includes('drama') && !movie.genres.includes('horror'))).toBe(true);
  await expect(page.getByTestId('movie-card')).toHaveCount(payload.items.length);
  await expect(page.locator('html')).toHaveAttribute('data-test-document', 'same-document');
  await expect(page).toHaveURL(/excludeGenres=horror/);
});

test('any/all genre mode and runtime sort retain the documented semantics', async ({ page }) => {
  await page.goto('/en/discover/?v=1&genres=drama,comedy&genreMode=all&runtimeMax=110&sort=runtime');
  await openFilters(page);
  await expect(page.getByLabel('Match all included genres', { exact: true })).toBeChecked();
  const response = await page.request.get('/api/movies?genres=drama,comedy&genreMode=all&runtimeMax=110&sort=runtime');
  const payload = pageSchema.parse(await response.json());
  expect(payload.items.every((movie) => movie.genres.includes('drama') && movie.genres.includes('comedy') && movie.runtime !== null && movie.runtime <= 110)).toBe(true);
  await expect(page.getByTestId('movie-card')).toHaveCount(payload.items.length);
  await expect(page.getByTestId('movie-card').first()).toContainText(payload.items[0]?.titleEn ?? 'missing expected result');
});

test('cached filter results are reused without a duplicate request', async ({ page }) => {
  let dramaRequests = 0;
  await page.route('**/api/movies?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('genres') === 'drama') dramaRequests++;
    await route.continue();
  });
  await page.goto('/en/discover/');
  await openFilters(page);
  await page.getByLabel('Include Drama', { exact: true }).click();
  await expect.poll(() => dramaRequests).toBe(1);
  await expect(page).toHaveURL(/genres=drama/);
  await expect(page.getByRole('status')).toContainText(/^Showing /);
  await expect(page.getByTestId('movie-card').first()).toContainText('The Space Between');
  await page.getByLabel('Include Drama', { exact: true }).click();
  await expect(page).not.toHaveURL(/genres=drama/);
  await page.getByLabel('Include Drama', { exact: true }).click();
  await expect(page).toHaveURL(/genres=drama/);
  await expect(page.getByTestId('movie-card').first()).toContainText('The Space Between');
  expect(dramaRequests).toBe(1);
});

test('details and browser Back restore filter state and scroll', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/en/discover/?v=1&genres=drama&runtimeMax=110');
  await expect(page.getByTestId('movie-card').first()).toContainText('The Space Between');
  await page.getByTestId('movie-card').first().scrollIntoViewIfNeeded();
  const previousScroll = await page.evaluate(() => window.scrollY);
  await page.getByTestId('movie-card').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/en\/movies\//);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('The Space Between');
  await page.goBack();
  await expect(page).toHaveURL(/genres=drama/);
  await expect(page.getByLabel('Runtime maximum', { exact: true })).toHaveValue('110');
  await expect(page.getByTestId('movie-card').first()).toContainText('The Space Between');
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - previousScroll)).toBeLessThan(12);
  expect(browserErrors).toEqual([]);
});

test('empty results preserve constraints and network failures have recovery', async ({ page }) => {
  await page.goto('/en/discover/?v=1&yearMin=1888&yearMax=1900');
  await openFilters(page);
  await expect(page.getByTestId('movie-card')).toHaveCount(0);
  await expect(page).toHaveURL(/yearMax=1900/);
  await page.route('**/api/movies?**', (route) => route.abort('internetdisconnected'));
  await page.getByLabel('Include Drama', { exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/genres=drama/);
});

test('keyboard intent prefetch requests a detail document and respects Save-Data', async ({ page }) => {
  await page.goto('/en/discover/');
  const detailRequest = page.waitForRequest((request) => request.url().includes('/en/movies/the-space-between/'));
  const detailResponse = page.waitForResponse((response) => response.url().includes('/en/movies/the-space-between/'));
  await page.getByTestId('movie-card').first().getByRole('link').first().focus();
  await detailRequest;
  await detailResponse;
  await page.getByTestId('movie-card').first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/en\/movies\/the-space-between\//);
  const resourceSchema = z.object({ encodedBodySize: z.number(), transferSize: z.number() });
  const resources = z.array(resourceSchema).parse(await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/en/movies/the-space-between/')).map((entry) => entry.toJSON())));
  const navigationFetch = resources.at(-1);
  expect(navigationFetch).toBeDefined();
  if (navigationFetch) expect(navigationFetch.transferSize).toBeLessThan(navigationFetch.encodedBodySize);
  await page.goto('/en/discover/');
  await page.evaluate(() => { Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g' } }); });
  let speculative = 0;
  page.on('request', (request) => { if (request.url().includes('/en/movies/')) speculative++; });
  await page.getByTestId('movie-card').nth(1).getByRole('link').first().focus();
  await page.waitForTimeout(350);
  expect(speculative).toBe(0);
});

test('rapid filter changes keep the latest result when an earlier request is delayed', async ({ page }) => {
  let releaseEarlier = () => {};
  const earlierReleased = new Promise<void>((resolve) => { releaseEarlier = resolve; });
  await page.route('**/api/movies?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('genres') === 'drama') await earlierReleased;
    await route.continue().catch(() => {});
  });
  await page.goto('/en/discover/');
  await openFilters(page);
  const earlier = page.waitForRequest((request) => new URL(request.url()).searchParams.get('genres') === 'drama');
  await page.getByLabel('Include Drama', { exact: true }).click();
  await earlier;
  await expect(page.getByLabel('Include Drama', { exact: true })).toBeChecked();
  const latest = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/movies' && new URL(response.url()).searchParams.get('genres') === 'comedy,drama');
  await page.getByLabel('Include Comedy', { exact: true }).click();
  const payload = pageSchema.parse(await (await latest).json());
  releaseEarlier();
  await expect(page.getByTestId('movie-card')).toHaveCount(payload.items.length);
  await expect(page).toHaveURL(/genres=comedy%2Cdrama/);
  await expect(page.getByLabel('Include Drama', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Include Comedy', { exact: true })).toBeChecked();
});

test('filter history Back and Forward restore controls without replacing the document', async ({ page }) => {
  await page.goto('/en/discover/');
  await openFilters(page);
  await page.evaluate(() => { document.documentElement.dataset.filterHistory = 'preserved'; });
  await page.getByLabel('Include Drama', { exact: true }).click();
  await expect(page).toHaveURL(/genres=drama/);
  await expect(page.getByTestId('movie-card').first()).toContainText('The Space Between');
  await page.getByLabel('Include Comedy', { exact: true }).click();
  await expect(page).toHaveURL(/genres=comedy%2Cdrama/);
  await page.goBack();
  await expect(page).toHaveURL(/genres=drama/);
  await expect(page.getByLabel('Include Comedy', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Include Drama', { exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-filter-history', 'preserved');
  await page.goForward();
  await expect(page).toHaveURL(/genres=comedy%2Cdrama/);
  await expect(page.getByLabel('Include Comedy', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Include Drama', { exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-filter-history', 'preserved');
});
