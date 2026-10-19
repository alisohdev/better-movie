import config from './playwright.config';
export default {
  ...config,
  testIgnore: [],
  testMatch: '**/staging.spec.ts',
  webServer: (Array.isArray(config.webServer) ? config.webServer : [config.webServer!]).map(server => ({ ...server, env: { ...server.env, CATALOG_FILE: process.env.CATALOG_FILE!, CATALOG_REVISION: process.env.CATALOG_REVISION!, TMDB_STAGING_DATABASE_URL: process.env.TMDB_STAGING_DATABASE_URL! } })),
  use: { ...config.use, launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : undefined },
};
