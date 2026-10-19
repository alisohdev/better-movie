import { expect, test, type Page } from '@playwright/test';

const recipes = [
  { en: '100 minutes or less', fa: '۱۰۰ دقیقه یا کمتر', query: 'v=1&runtimeMax=100', total: 0 },
  { en: 'Thrillers, without horror', fa: 'دلهره‌آور، بدون ترسناک', query: 'v=1&genres=thriller&excludeGenres=horror', total: 5 },
  { en: 'From 1990 to 1999', fa: 'از ۱۹۹۰ تا ۱۹۹۹ میلادی', query: 'v=1&yearMin=1990&yearMax=1999', total: 0 },
];

async function ready(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.getByTestId('results')).toHaveAttribute('aria-busy', 'false');
}

for (const locale of ['en', 'fa'] as const) {
  const fa = locale === 'fa';
  test(`${locale}: each literal recipe, visible constraints, history, cached results and reset`, async ({ page }, testInfo) => {
    const calls: string[] = [], titles: string[] = [], errors: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/movies') calls.push(url.search);
      if (url.pathname === '/api/titles') titles.push(url.search);
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/${locale}/discover/?v=1&languages=fa&ratingMin=9&voteCountMin=1000&sort=rating&page=2`);
    await ready(page);
    await expect(page.locator('#recipe-explanation')).toContainText(fa ? 'جایگزین' : 'replaces');
    for (const [index, recipe] of recipes.entries()) {
      const button = page.getByRole('button', { name: recipe[locale], exact: true });
      // Enter is the keyboard path; mobile's click maps to the touch path.
      if (testInfo.project.name === 'desktop') { await button.focus(); await button.press('Enter'); }
      else await button.tap();
      await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${recipe.query}`);
      await ready(page);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      const response = await page.request.get(`/api/movies?${recipe.query}`);
      expect(response.ok()).toBe(true);
      const result = await response.json();
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(12);
      if (recipe.total) expect(result.total).toBe(recipe.total);
      expect(result.items.every((movie: { runtime: number | null; year: number | null; genres: string[] }) =>
        index === 0 ? movie.runtime !== null && movie.runtime <= 100 :
        index === 1 ? movie.genres.includes('thriller') && !movie.genres.includes('horror') :
        movie.year !== null && movie.year >= 1990 && movie.year <= 1999)).toBe(true);
      await expect(page.getByTestId('movie-card')).toHaveCount(result.items.length);
      await expect(page.locator('.active-filters')).toContainText(index === 0 ? '100' : index === 1 ? (fa ? 'بدون' : 'No Horror') : '1990');
      await expect(page.locator('.active-filters')).not.toContainText(fa ? 'حداقل امتیاز' : 'Minimum score');
      const recipeCalls = calls.filter((query) => query === `?${recipe.query}`).length;
      expect(recipeCalls).toBe(1);
      await page.goBack();
      await ready(page);
      await page.goForward();
      await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${recipe.query}`);
      await ready(page);
      await expect(page.getByTestId('movie-card')).toHaveCount(result.items.length);
      expect(calls.filter((query) => query === `?${recipe.query}`)).toHaveLength(recipeCalls);
    }
    const toggle = page.locator('.filter-toggle');
    if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await page.getByRole('button', { name: fa ? 'پاک کردن فیلترها' : 'Clear filters', exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?v=1`);
    await ready(page);
    await expect(page.locator('.active-filters')).toHaveCount(0);
    await expect(page.getByTestId('movie-card')).toHaveCount(12);
    await expect(page.locator('.recipe[aria-pressed="true"]')).toHaveCount(0);
    expect(titles).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${locale}: zero results keep every constraint until one explicit edit, with reversible history and locale switching`, async ({ page }, testInfo) => {
    const query = 'v=1&languages=en&countries=GB&excludeGenres=horror&runtimeMax=1&ratingMin=8&voteCountMin=300&sort=rating';
    const target = query.replace('&runtimeMax=1', '');
    const calls: string[] = [], titles: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.pathname === '/api/movies') calls.push(url.search);
      if (url.pathname === '/api/titles') titles.push(url.search);
    });
    await page.goto(`/${locale}/discover/?${query}`);
    await ready(page);
    const empty = page.locator('.empty-state');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(fa ? 'همهٔ فیلترها حفظ شده‌اند' : 'Every preference is still applied');
    await expect(empty).toContainText(fa ? 'اطلاعات نامشخص' : 'metadata may be missing');
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${query}`);
    const recovery = empty.locator('.recovery-actions');
    await expect(recovery.getByRole('button')).toHaveCount(2);
    await testInfo.attach(`${locale}-explicit-recovery`, { body: await page.screenshot(), contentType: 'image/png' });
    const edit = recovery.getByRole('button', { name: fa ? 'حذف حداکثر زمان فیلم (۱ دقیقه)' : 'Remove maximum runtime (1 min)', exact: true });
    await edit.click();
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${target}`);
    await ready(page);
    await expect(page.locator('.empty-state')).toHaveCount(0);
    await expect(page.locator('.active-filters')).toContainText(fa ? 'بدون' : 'No Horror');
    const response = await page.request.get(`/api/movies?${target}`);
    const result = await response.json();
    expect(response.ok()).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((movie: { originalLanguage: string; countries: string[]; rating: number; voteCount: number; genres: string[] }) => movie.originalLanguage === 'en' && movie.countries.includes('GB') && movie.rating >= 8 && movie.voteCount >= 300 && !movie.genres.includes('horror'))).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${query}`);
    await ready(page);
    await expect(empty).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${target}`);
    await ready(page);
    expect(calls).toEqual([`?${query}`, `?${target}`]);
    await page.getByRole('link', { name: fa ? 'Switch to English' : 'Switch to Persian', exact: true }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${fa ? 'en' : 'fa'}/discover/?${target}`);
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('dir', fa ? 'ltr' : 'rtl');
    expect(titles).toEqual([]);
  });

  test(`${locale}: explicitly remove one exclusion without weakening the others`, async ({ page }) => {
    const valid = 'v=1&languages=en&countries=US&excludeGenres=horror%2Cthriller&ratingMin=10&voteCountMin=100';
    const fixture = await (await page.request.get(`/api/movies?${valid}`)).json();
    expect(fixture.total).toBe(0);
    await page.goto(`/${locale}/discover/?${valid}`);
    await ready(page);
    const edits = page.locator('.recovery-actions');
    await expect(edits.getByRole('button')).toHaveCount(2);
    const before = new URL(page.url()).searchParams;
    const exclusions = before.get('excludeGenres')!.split(',');
    await edits.getByRole('button').first().click();
    await ready(page);
    const after = new URL(page.url()).searchParams;
    expect(after.get('excludeGenres')).toBe(exclusions.slice(1).join(','));
    expect(after.get('ratingMin')).toBe(before.get('ratingMin'));
    expect(after.get('voteCountMin')).toBe(before.get('voteCountMin'));
    expect(after.get('genres')).toBe(before.get('genres'));
    expect(after.get('languages')).toBe(before.get('languages'));
    expect(after.get('countries')).toBe(before.get('countries'));
    await expect(page.locator('.empty-state')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`http://127.0.0.1:4321/${locale}/discover/?${valid}`);
  });
}
