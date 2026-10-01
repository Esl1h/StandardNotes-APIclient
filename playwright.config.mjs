import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  // Builds once and serves like the Standard Notes dev install does;
  // reuse an already running preview server when possible.
  webServer: {
    command: 'npm run build && npm run server-cors',
    url: 'http://localhost:3000/index.html',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
