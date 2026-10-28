import { defineConfig, devices } from '@playwright/test';

// BASE_URL points the suite at an already-deployed site (post-deploy verification);
// otherwise it builds and serves the preview locally.
const liveUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: '**/debug*.spec.js',
  fullyParallel: true,
  retries: 1,
  use: { baseURL: liveUrl ?? 'http://localhost:4173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: liveUrl
    ? undefined
    : {
        command: 'npm run preview -- --port 4173',
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
});
