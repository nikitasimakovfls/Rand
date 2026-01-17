import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix } from '../utils/helpers';

test.describe('Admin Workflow - Patient Management', () => {
  const firstName = 'A_Regression_Name';
  const lastName = 'A_Regression_Sec_Name';
  const testMRN = '22222222222';

  test('should successfully create, find on any page and remove a patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);
    const randomSuffix = generateRandomSuffix();
    const testEmail = `patient_${randomSuffix}@example.com`;
    const redcapId = randomSuffix;

    // Authorization
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/.*admin/, { timeout: 15000 });

    // Open Patient Creation Form
    await adminPage.goToPatients();
    await adminPage.openAddPatientForm();
    
    // Fill Patient Data
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

    // Submit Form and verify redirection
    await adminPage.submitForm(/\/admin\/patient/);

    // Verify patient existence with auto-waiting (Fix for stability)
    const firstNameSortBtn = page.getByRole('button', { name: 'First Name' });
    await firstNameSortBtn.click();
    await page.waitForLoadState('networkidle');
    console.log(`Searching for newly created patient: ${firstName} ${lastName}`);
    const patientRow = page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await expect(patientRow).toBeVisible({ timeout: 10000 });

    // Cleanup (Removal)
    await adminPage.deletePatientByName(firstName, lastName);
    
    // Verify the patient is no longer visible in the table
    await expect(patientRow).not.toBeVisible({ timeout: 10000 });
  });
});