import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { testHeaders as headers } from './test-headers.mjs';
const base = process.env.PREVIEW_URL;
if (!base) throw new Error('PREVIEW_URL is required');
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL});
const report = {base, samples:[], errors:[], injectedFailures:[]};
try {
for(const [locale,width,height] of [['en',1440,1000],['fa',390,844]]) {
 const context=await browser.newContext({viewport:{width,height},extraHTTPHeaders:headers,reducedMotion:'reduce'});
 const page=await context.newPage();
 let injected=false;
 page.on('pageerror', e=>report.errors.push({locale,type:'pageerror',message:e.message}));
 page.on('console', m=>{if(m.type()==='error') (injected && m.text().includes('503') ? report.injectedFailures : report.errors).push({locale,type:'console',message:m.text()})});
 const apiResponses=[];page.on('response',r=>{if(new URL(r.url()).pathname==='/api/movies')apiResponses.push({status:r.status(),url:r.url()})});
 await page.goto(new URL(`/${locale}/discover/`,base).href,{waitUntil:'networkidle'});
 await expect(page.getByTestId('movie-card')).toHaveCount(12);
 const toggle=page.getByRole('button',{name:locale==='en'?/^Your preferences/:/^سلیقه/});
 if(await toggle.isVisible() && await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 const genre=page.getByLabel(locale==='en'?'Include Drama':'افزودن درام',{exact:true});
 let release; const held=new Promise(r=>release=r);
 await page.route('**/api/movies?**',async route=>{await held;await route.continue()});
 await genre.click();
 await expect(page.getByRole('status')).toContainText(locale==='en'?'Updating':'در حال');
 release();await expect(page.getByRole('status')).not.toContainText(locale==='en'?'Updating':'در حال');
 await expect(page.getByTestId('movie-card').first()).toBeVisible();
 await page.unroute('**/api/movies?**');
 const count=apiResponses.length;
 await genre.click();await expect(page).not.toHaveURL(/genres=drama/);await genre.click();
 await expect(page).toHaveURL(/genres=drama/);
 await expect(page.getByRole('status')).not.toContainText(locale==='en'?'Updating':'در حال');
 expect(apiResponses.length).toBe(count);
 await page.getByTestId('movie-card').first().getByRole('link').first().click();
 await expect(page).toHaveURL(/\/movies\//);await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await page.goBack();await expect(page).toHaveURL(/genres=drama/);
 await page.goForward();await expect(page).toHaveURL(/\/movies\//);
 await page.goBack();await expect(page).toHaveURL(/genres=drama/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/screenshots/remote-${locale}.png`,fullPage:true});
 await expect(page.getByRole('status')).toContainText(locale === 'en' ? /^Showing / : /^نمایش /);
 // Induced 503 tests UI recovery without modifying Neon or deployment state.
 const toggleAgain=page.getByRole('button',{name:locale==='en'?/^Your preferences/:/^سلیقه/});
 if(await toggleAgain.isVisible() && await toggleAgain.getAttribute('aria-expanded')==='false')await toggleAgain.click();
 injected=true;
 await page.route('**/api/movies?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'service_unavailable',message:'The catalog is temporarily unavailable.'}})}));
 await page.getByLabel(locale==='en'?'Include Comedy':'افزودن کمدی',{exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible({timeout:15000});
 await page.unroute('**/api/movies?**');
 const recovered = page.waitForResponse(r => new URL(r.url()).pathname === '/api/movies' && r.status() === 200);
 await page.getByRole('button',{name:locale==='en'?'Try again':'تلاش دوباره',exact:true}).click();
 await (await recovered).finished();
 await expect(page.getByRole('alert')).not.toBeVisible();
 injected=false;
 report.samples.push({locale,width,height,loading:true,errorRecovery:true,cacheReuse:true,backForward:true,apiResponses});
 await context.close();
}
expect(report.errors).toEqual([]);
} finally { await browser.close();await writeFile('.local/remote-extra.json',JSON.stringify(report,null,2)); }
console.log(JSON.stringify(report,null,2));
