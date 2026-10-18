import { expect, test, type Page } from '@playwright/test';

async function controls(page: Page, fa: boolean) {
  const toggle = page.getByRole('button', { name: fa ? /^سلیقه/ : /^Your preferences/ });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const advanced = page.locator('.advanced-filters');
  if (await advanced.getAttribute('open') === null) await advanced.locator(':scope > summary').click();
  return advanced;
}
for (const locale of ['en', 'fa']) {
  const fa = locale === 'fa';
  test(`${locale}: multiple selections, scores, chips, history, details and full reset`, async ({ page }) => {
    const discoveryRequests = new Map<string, number>();
    page.on('request', (r) => {
      const target = new URL(r.url());
      if (target.pathname === '/api/movies') discoveryRequests.set(target.search, (discoveryRequests.get(target.search) ?? 0) + 1);
    });
    await page.goto(`/${locale}/discover/?v=1&page=2`);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const panel = await controls(page, fa);
    await panel.locator('.advanced-options').nth(0).locator('summary').click();
    await panel.getByRole('checkbox', { name: fa ? 'فارسی' : 'Persian', exact: true }).check();
    await expect(page).not.toHaveURL(/page=/);
    await panel.getByRole('checkbox', { name: fa ? 'انگلیسی' : 'English', exact: true }).check();
    await expect(page).toHaveURL(/languages=en%2Cfa/);
    await panel.locator('.advanced-options').nth(1).locator('summary').click();
    await panel.getByRole('checkbox', { name: fa ? 'ایران' : 'Iran', exact: true }).check();
    await panel.getByRole('checkbox', { name: fa ? 'ایالات متحده' : 'United States', exact: true }).check();
    await panel.getByLabel(fa ? 'حداقل امتیاز (۰ تا ۱۰)' : 'Minimum score (0–10)', { exact: true }).fill('7.8');
    await panel.getByRole('button', { name: fa ? 'اعمال امتیازها' : 'Apply scores', exact: true }).click();
    await expect(page).toHaveURL(/ratingMin=7.8/);
    expect(new URL(page.url()).searchParams.has('voteCountMin')).toBe(false);
    await panel.getByLabel(fa ? 'حداقل تعداد رأی (اختیاری)' : 'Minimum vote count (optional)', { exact: true }).fill('200');
    await panel.getByRole('button', { name: fa ? 'اعمال امتیازها' : 'Apply scores', exact: true }).click();
    await expect(page).toHaveURL(/voteCountMin=200/);
    await expect(page.getByTestId('movie-card')).toHaveCount(7);
    const url = page.url();
    const targetSearch = new URL(url).search;
    expect(discoveryRequests.get(targetSearch)).toBe(1);
    const active = page.locator('.active-filters');
    await expect(active.getByRole('button')).toHaveCount(6);
    for (const threshold of await active.locator('bdi').all()) await expect(threshold).toHaveAttribute('dir', 'ltr');
    await active.getByRole('button', { name: fa ? /امتیاز خیالی/ : /Fictional score/ }).click();
    await expect(page).not.toHaveURL(/ratingMin=/);
    await expect(page).toHaveURL(/voteCountMin=200/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    await expect(panel.getByLabel(fa ? 'حداقل امتیاز (۰ تا ۱۰)' : 'Minimum score (0–10)', { exact: true })).toHaveValue('7.8');
    await expect(page.getByTestId('movie-card')).toHaveCount(7);
    await page.goForward();
    await expect(page).not.toHaveURL(/ratingMin=/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    await active.getByRole('button', { name: fa ? /کشور: ایران/ : /Country: Iran/ }).click();
    await expect(page).toHaveURL(/countries=US/);
    await expect(page).toHaveURL(/languages=en%2Cfa/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    await active.getByRole('button', { name: fa ? /زبان: انگلیسی/ : /Language: English/ }).click();
    await expect(page).toHaveURL(/languages=fa&/);
    await expect(page).toHaveURL(/countries=IR%2CUS/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    expect(discoveryRequests.get(targetSearch)).toBe(1);
    const panelOpen = await page.locator('.filter-disclosure').getAttribute('data-open');
    const first = page.getByTestId('movie-card').first();
    await first.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await first.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/movies/`));
    await page.goBack();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId('movie-card')).toHaveCount(7);
    await expect(page.locator('.filter-disclosure')).toHaveAttribute('data-open', panelOpen ?? 'false');
    await expect(panel).toHaveAttribute('open', '');
    await expect(panel.locator('.advanced-options[open]')).toHaveCount(2);
    await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThan(12);
    expect(discoveryRequests.get(targetSearch)).toBe(1);
    await controls(page, fa);
    await page.getByRole('button', { name: fa ? 'پاک کردن فیلترها' : 'Clear filters', exact: true }).click();
    await expect(page).toHaveURL(/\?v=1$/);
    await expect(page.locator('.active-filters')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${locale}: score validation, empty constraints, individual clearing and locale round trip`, async ({ page }) => {
    await page.goto(`/${locale}/discover/?v=1&languages=ja&countries=IR&ratingMin=10&voteCountMin=0`);
    await expect(page.getByTestId('movie-card')).toHaveCount(0);
    await expect(page.locator('.empty-state')).toBeVisible();
    const panel = await controls(page, fa);
    const rating = panel.getByLabel(fa ? 'حداقل امتیاز (۰ تا ۱۰)' : 'Minimum score (0–10)', { exact: true });
    await rating.fill('10.1');
    await panel.getByRole('button', { name: fa ? 'اعمال امتیازها' : 'Apply scores', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/ratingMin=10&voteCountMin=0/);
    if (fa) await expect(page.getByRole('alert')).not.toContainText(/[A-Za-z]/);
    await panel.getByRole('button', { name: fa ? 'پاک کردن امتیازها' : 'Clear scores', exact: true }).click();
    await expect(page).not.toHaveURL(/ratingMin=/);
    await expect(page).toHaveURL(/languages=ja&countries=IR/);
    await panel.locator('.advanced-options').nth(1).locator('summary').click();
    await panel.getByRole('button', { name: fa ? 'پاک کردن کشورها' : 'Clear countries', exact: true }).click();
    await expect(page.getByTestId('movie-card')).toHaveCount(2);
    await page.getByRole('link', { name: fa ? 'Switch to English' : 'Switch to Persian', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${fa ? 'en' : 'fa'}/discover/\\?v=1&languages=ja`));
    await expect(page.locator('html')).toHaveAttribute('dir', fa ? 'ltr' : 'rtl');
    await expect(page.getByTestId('movie-card')).toHaveCount(2);
  });

  test(`${locale}: advanced filters never retrigger a settled full-cache title query`, async ({ page }) => {
    await page.goto(`/${locale}/discover/`);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const input = page.getByRole('combobox', { name: fa ? 'جست‌وجوی عنوان فیلم' : 'Search movie titles' });
    const requests: string[] = [];
    page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/titles') requests.push(new URL(r.url()).searchParams.get('q') ?? ''); });
    for (const title of ['paper', 'last', 'space', 'sea', 'silence', 'orange', 'train']) {
      const settled = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/titles' && new URL(r.url()).searchParams.get('q') === title);
      await input.fill(title);
      await settled;
      await expect(page.getByRole('listbox')).toHaveAttribute('aria-busy', 'false');
      await expect.poll(() => requests.includes(title)).toBe(true);
    }
    await input.fill('orbit');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
    await page.waitForTimeout(5100);
    const before = [...requests];
    expect(requests.filter((q) => q === 'orbit')).toHaveLength(1);
    const panel = await controls(page, fa);
    await panel.locator('.advanced-options').nth(0).locator('summary').click();
    await panel.getByRole('checkbox', { name: fa ? 'فارسی' : 'Persian', exact: true }).check();
    await panel.locator('.advanced-options').nth(1).locator('summary').click();
    await panel.getByRole('checkbox', { name: fa ? 'ایران' : 'Iran', exact: true }).check();
    await panel.getByLabel(fa ? 'حداقل امتیاز (۰ تا ۱۰)' : 'Minimum score (0–10)', { exact: true }).fill('8');
    await panel.getByRole('button', { name: fa ? 'اعمال امتیازها' : 'Apply scores', exact: true }).click();
    await expect(page).toHaveURL(/ratingMin=8/);
    await panel.getByLabel(fa ? 'حداقل تعداد رأی (اختیاری)' : 'Minimum vote count (optional)', { exact: true }).fill('100');
    await panel.getByRole('button', { name: fa ? 'اعمال امتیازها' : 'Apply scores', exact: true }).click();
    await expect(page).toHaveURL(/voteCountMin=100/);
    await input.focus();
    await input.press('ArrowDown');
    await expect(page.getByRole('listbox').getByRole('option')).toContainText(fa ? 'مدار دو نفر' : 'Orbit of Two');
    await page.waitForTimeout(350);
    expect(requests).toEqual(before);
  });
}

for (const locale of ['en', 'fa']) test(`${locale}: malformed advanced URLs show an error without sending a broader discovery query`, async ({ page }) => {
  for (const query of ['languages=xx', 'countries=IR,IR', 'ratingMin=10.1', 'voteCountMin=-1', 'ratingMin=0&ratingMin=1']) {
    const calls: string[] = [];
    const listener = (r: { url(): string }) => { if (new URL(r.url()).pathname === '/api/movies') calls.push(r.url()); };
    page.on('request', listener);
    await page.goto(`/${locale}/discover/?v=1&${query}`);
    await expect(page.getByRole('alert')).toContainText(locale === 'en' ? 'This filter link needs a correction' : 'این پیوند فیلتر نیاز به اصلاح دارد');
    if (locale === 'fa') await expect(page.getByRole('alert')).not.toContainText(/[A-Za-z]/);
    expect(calls).toEqual([]);
    page.off('request', listener);
  }
});
