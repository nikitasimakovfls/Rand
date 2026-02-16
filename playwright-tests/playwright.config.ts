import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Define custom options type to avoid TypeScript errors
 */
interface CustomOptions {
  euTimezone?: string;
  usTimezone?: string;
}

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

/**
 * Read configurable timezones from .env
 */
const EU_TIMEZONE = process.env.EU_TIMEZONE;
const US_TIMEZONE = process.env.US_TIMEZONE;

// Pass CustomOptions to defineConfig to register new properties
export default defineConfig<CustomOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: targetURL,
    /**
     * Custom parameters are now recognized by TypeScript
     */
    euTimezone: EU_TIMEZONE,
    usTimezone: US_TIMEZONE,
    
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        /**
         * Note: Playwright's native timezoneId setting for the browser context.
         */
        timezoneId: EU_TIMEZONE 
      },
    },
  ],
});