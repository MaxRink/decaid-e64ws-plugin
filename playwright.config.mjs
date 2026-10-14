import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './test',
  outputDir: 'test-results',
  reporter: [['list'], ['html', {outputFolder: 'playwright-report', open: 'never'}]],
  use: {trace: 'retain-on-failure'},
  timeout: 30_000,
});
