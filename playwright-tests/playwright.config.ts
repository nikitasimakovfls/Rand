import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from .env file.
 * We use path.resolve to ensure the path is correct on Linux/Ubuntu.
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    /* * IMPORTANT: Using APP_URL from your .env file.
     * We add a fallback to the string URL just in case.
     */
    baseURL: process.env.APP_URL || 'https://dev.itreat.clnapp.com',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Video is very helpful for debugging on VM
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox and Webkit often have issues with GUI/Drivers on VMs, 
    // so Chromium is our primary target.
  ],
});