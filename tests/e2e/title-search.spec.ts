import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, locale = 'en', search = '') {
  await page.goto(`/${locale}/discover/${search}`);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  return page.getByRole('combobox', { name: locale === 'fa' ? 'جست‌وجوی عنوان فیلم' : 'Search movie titles' });
}

for (const locale of ['en', 'fa']) {
  test(`${locale}: title lookup is independent of filters, keyboard opens details, Back restores filters`, async ({ page }) => {
    const input = await open(page, locale, '?v=1&runtimeMax=100');
    const url = page.url();
    const search = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/titles');
    await input.fill('THE SPACE BETWEEN');
    const payload = await (await search).json();
    expect(payload.items.map((item: { id: string }) => item.id)).toEqual(['the-space-between']);
    const option = page.getByRole('listbox').getByRole('option');
    await expect(option).toHaveCount(1);
    await expect(option).toContainText(locale === 'fa' ? 'فاصله میان ما' : 'The Space Between');
    await expect(option).toContainText('2024');
    if (locale === 'fa') await expect(option).toContainText('The Space Between');
    expect(page.url()).toBe(url);
    if ((page.viewportSize()?.width ?? 1440) < 600) {
      const popup = await page.locator('.title-search-popup').boundingBox();
      expect(popup).not.toBeNull();
      expect(popup!.y + popup!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
    expect(await input.getAttribute('dir')).toBe('auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await input.press('ArrowDown');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', await option.getAttribute('id') ?? 'missing');
    await input.press('Escape');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(option).toHaveCount(0);
    await input.press('ArrowDown');
    await expect(option).toHaveCount(1);
    await input.press('ArrowUp');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await input.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${locale}/movies/the-space-between/`));
    await page.goBack();
    await expect(page).toHaveURL(url);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect(page.getByTestId('movie-card').first()).not.toContainText('The Space Between');
  });

  test(`${locale}: normalized Persian suggestions support touch selection and missing Persian fallback`, async ({ page }) => {
    const input = await open(page, locale);
    await input.fill('آخَرِين\u200cقطار  تا سپیده');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('listbox').getByRole('option')).toContainText('2023');
    await page.getByRole('listbox').getByRole('option').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/movies/last-train-to-dawn/`));
    await open(page, locale);
    // Simulate an unavailable translation without adding movies to the fixture.
    await page.route('**/api/titles?**', async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.items = payload.items.map((item: object) => ({ ...item, titleFa: null }));
      await route.fulfill({ response, json: payload });
    });
    await input.fill('still life');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('listbox').getByRole('option')).toContainText('Still Life with a Road');
  });
}

test('typing is debounced, results are bounded, arrows wrap, Escape and clear dismiss', async ({ page }) => {
  const input = await open(page);
  const queries: string[] = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/titles') queries.push(new URL(r.url()).searchParams.get('q') ?? ''); });
  await input.pressSequentially('the', { delay: 25 });
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(6);
  expect(queries).toEqual(['the']);
  await input.press('ArrowUp');
  await expect(page.getByRole('listbox').getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  await expect(page.getByRole('listbox').getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Clear title search' }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(queries).toEqual(['the']);
});

test('loading, empty, invalid and API failure have distinct states with retry', async ({ page }) => {
  const input = await open(page);
  let fail = true;
  await page.route('**/api/titles?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (fail) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"service_unavailable","message":"Unavailable"}}' });
    else await route.continue();
  });
  await input.fill('orbit');
  await expect(page.locator('.title-search-status')).toHaveText('Looking up titles…');
  await expect(page.locator('.title-search-status')).toContainText('unavailable');
  await expect(page.locator('.title-search-status')).not.toContainText('No matches');
  fail = false;
  await page.getByRole('button', { name: 'Retry title search' }).click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await input.fill('مدار Orbit');
  await expect(page.locator('.title-search-status')).toContainText('No matches');
  await input.fill('x'.repeat(121));
  await expect(page.locator('.title-search-status')).toContainText('120 characters');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(0);
  await input.fill('orbit');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.getByRole('heading', { name: 'Less searching. More cinema.' }).click();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
});

test('obsolete lookup is canceled immediately and delayed results cannot overwrite newer input', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/titles?**', async (route) => {
    const response = await route.fetch();
    if (new URL(route.request().url()).searchParams.get('q') === 'orbit') await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  const input = await open(page);
  const earlier = page.waitForRequest((r) => new URL(r.url()).searchParams.get('q') === 'orbit');
  await input.fill('orbit');
  await earlier;
  const aborted = page.waitForEvent('requestfailed', (r) => new URL(r.url()).searchParams.get('q') === 'orbit');
  await input.fill('paper');
  await aborted;
  await expect(page.getByRole('listbox').getByRole('option')).toContainText('Paper Skies');
  release();
  await expect(page.getByRole('listbox').getByRole('option')).toContainText('Paper Skies');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  expect(new URL(page.url()).search).toBe('');
});

test('composition waits for committed input and offline lookup explains the connection state', async ({ page, context }) => {
  const input = await open(page);
  const requests: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/api/titles') requests.push(request.url()); });
  await input.dispatchEvent('compositionstart');
  await input.fill('orbit');
  await page.waitForTimeout(250);
  expect(requests).toHaveLength(0);
  await input.dispatchEvent('compositionend');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await input.fill('paper');
  await expect(page.locator('.title-search-status')).toContainText('offline');
  await expect(page.locator('.title-search-status')).not.toContainText('No matches');
  await context.setOffline(false);
  await expect(page.getByRole('listbox').getByRole('option')).toContainText('Paper Skies');
});
