import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Getting var from .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * URL selecting logic base on ENV vars
 */
const environments = {
  dev: process.env.DEV_URL || 'https://dev.itreat.clnapp.com',
  prod1: process.env.PROD1_URL,
  prod2: process.env.PROD2_URL,
};

// Reading ENV from cmd
const ENV = (process.env.ENV as keyof typeof environments) || 'dev';
const targetURL = environments[ENV] || environments.dev;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: targetURL,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});