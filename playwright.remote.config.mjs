import { defineConfig, devices } from '@playwright/test';
import { testHeaders } from './scripts/test-headers.mjs';
if (!process.env.PREVIEW_URL) throw new Error('PREVIEW_URL must identify the committed Preview deployment');
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, retries: 0, workers: 1,
  reporter: [['list'], ['json', { outputFile: '.local/remote-e2e.json' }]],
  use: { baseURL: process.env.PREVIEW_URL, extraHTTPHeaders: testHeaders, trace: 'off', channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [
    { name: 'remote-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'remote-mobile', use: { ...devices['Pixel 7'], reducedMotion: 'reduce' } },
  ],
});
