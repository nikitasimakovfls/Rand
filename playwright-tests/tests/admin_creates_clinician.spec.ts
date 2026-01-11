import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix } from '../utils/helpers';

test.describe('Admin Workflow - Clinician Lifecycle', () => {
  const doctorName = 'A_Regression Doctor';

  test('should create, find and delete a clinician', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);

    const randomSuffix = generateRandomSuffix();
    const testEmail = `clinician_${randomSuffix}@example.com`;

    // 1. Authorization
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/.*admin/, { timeout: 15000 });

    // 2. Clinician creation
    await adminPage.goToClinicians();
    await adminPage.openAddClinicianForm();
    await adminPage.fillClinicianData(doctorName, testEmail);
    await adminPage.addClinicToClinician();
    await adminPage.submitClinicianForm();

    // 3. Verify existence with auto-waiting (Fix)
    console.log(`Searching for newly created doctor: ${testEmail}`);
    
    // Using a locator with visibility expectation
    const clinicianRow = page.locator('tr', { hasText: testEmail });
    await expect(clinicianRow).toBeVisible({ timeout: 10000 });

    // 4. Deletion and absence verification
    console.log(`Deleting doctor: ${testEmail}`);
    await adminPage.deleteClinicianByEmail(testEmail);
    
    // Verify that the email is no longer visible in the table
    await expect(page.locator(`td:has-text("${testEmail}")`)).not.toBeVisible({ timeout: 10000 });
  });
});