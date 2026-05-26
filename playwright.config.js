// Playwright configuration for the Rosy Recruits smoke suite.
// Tests run against the live demo deployment by default; override with
// BASE_URL env var to point at a preview deploy or localhost.
//
// Run locally:        npm test
// Watch UI:           npm run test:ui
// Headed (visible):   npm run test:headed
// Show last report:   npm run test:report

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup.js'),
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // signup tests write to shared auth.users — serial is safer
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Single worker locally + CI — Supabase auth rate-limits parallel logins
  // for the same admin account, which causes flake. Total runtime is still
  // ~2 minutes for the current ~21 tests.
  workers: 1,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://rosy-demo.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    // SLOW_MO=500 makes headed runs visible — each action waits 500ms so a
    // human can watch. Set in terminal: SLOW_MO=500 npm test -- --headed
    launchOptions: process.env.SLOW_MO ? { slowMo: Number(process.env.SLOW_MO) } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
