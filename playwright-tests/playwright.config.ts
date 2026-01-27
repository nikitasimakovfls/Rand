import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Environment selection logic based on ENV variable
 */
const environments = {
  dev: process.env.DEV_URL || 'https://dev.itreat.clnapp.com',
  stage: process.env.STAGE_URL,
  prod1: process.env.PROD1_URL,
  prod2: process.env.PROD2_URL,
};

// Determine target environment and URL
const ENV = (process.env.ENV as keyof typeof environments) || 'dev';
const targetURL = environments[ENV] || environments.dev;

//console.log(`\n🚀 Running tests on environment: [${ENV}] | URL: ${targetURL}\n`);

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

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});