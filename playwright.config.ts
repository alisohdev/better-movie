import { defineConfig, devices } from '@playwright/test';

const databaseURL = process.env.DATABASE_URL ?? 'postgres://movie@127.0.0.1:55432/movie_discovery?sslmode=disable';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], reducedMotion: 'reduce' } },
  ],
  webServer: [
    {
      command: 'go run ./cmd/server',
      url: 'http://127.0.0.1:8080/api/health',
      reuseExistingServer: !process.env.CI,
      env: { DATABASE_URL: databaseURL, PORT: '8080' },
      timeout: 120000,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock',
      url: 'http://127.0.0.1:4321/en/discover/',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
