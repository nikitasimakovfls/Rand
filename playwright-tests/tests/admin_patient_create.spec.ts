import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix } from '../utils/helpers';

test.describe('Admin Workflow - Patient Management', () => {
  const firstName = 'Regression_Name';
  const lastName = 'Regression_Sec_Name';
  const testMRN = '22222222222';

  test('should successfully create, find on any page and remove a patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);

    const randomSuffix = generateRandomSuffix();
    const testEmail = `patient_${randomSuffix}@example.com`;
    const redcapId = randomSuffix;

    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/.*admin/, { timeout: 15000 });

    await adminPage.goToPatients();
    await adminPage.openAddPatientForm();
    
    await adminPage.fillPatientData({
      first: firstName,
      last: lastName,
      email: testEmail,
      sex: 'Male',
      phone: '111111111111',
      redcap: redcapId,
      mrn: testMRN,
      clinic: 'Regression Clinic',
      lang: 'English'
    });

    await adminPage.submitForm('**/admin/patient');
    const isFound = await adminPage.findPatientByName(firstName, lastName);
    expect(isFound).toBe(true);

    await adminPage.deletePatientByName(firstName, lastName);
    await expect(page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName }))
        .not.toBeVisible();
  });
});