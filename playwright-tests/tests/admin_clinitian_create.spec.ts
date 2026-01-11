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

    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/.*admin/, { timeout: 15000 });

    await adminPage.goToClinicians();
    await adminPage.openAddClinicianForm();
    await adminPage.fillClinicianData(doctorName, testEmail);
    await adminPage.addClinicToClinician();
    await adminPage.submitClinicianForm();

    console.log(`Searching for newly created doctor: ${testEmail}`);
    const found = await adminPage.findClinicianByEmail(testEmail);
    expect(found).toBe(true);

    await adminPage.deleteClinicianByEmail(testEmail);
    await expect(page.locator(`td:has-text("${testEmail}")`)).not.toBeVisible();
  });
});