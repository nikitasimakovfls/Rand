import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Multi-role Authentication', () => {

  // Define test accounts for different system roles
  const users = [
    { role: 'Admin', user: process.env.ADMIN_USER!, pass: process.env.ADMIN_PASSWORD!, expectedPath: '/admin' },
    { role: 'Clinician', user: process.env.CLINICIAN_USER!, pass: process.env.CLINICIAN_PASSWORD!, expectedPath: '/clinician' },
    { role: 'Patient', user: process.env.PATIENT_USER!, pass: process.env.PATIENT_PASSWORD!, expectedPath: '/questionnaire' },
  ];

  // Parameterized tests for each role
  for (const account of users) {
    test(`should successfully login as ${account.role}`, async ({ page }) => {
      const loginPage = new LoginPage(page);
      await page.goto('/');

      try {
        // Step-by-step authentication with error handling
        await loginPage.enterUsername(account.user);
        await loginPage.enterPassword(account.pass);

        // Strict verification of the destination URL
        const finalUrl = `https://dev.itreat.clnapp.com${account.expectedPath}`;
        await expect(page).toHaveURL(finalUrl, { timeout: 20000 });
        
        console.log(`Successfully reached: ${finalUrl}`);
      } catch (error) {
        // Captures specific Step 1 or Step 2 errors from the LoginPage class
        console.error(`Login Error for ${account.role}: ${error.message}`);
        throw error; 
      }
    });
  }
});