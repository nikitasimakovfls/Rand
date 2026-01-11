import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix } from '../utils/helpers';

test.describe('Clinician/Admin Cross-Role Workflow', () => {
  
  const firstName = 'A_Regression_Name';
  const lastName = 'A_Regression_Last';
  const testMRN = '55555555555';

  test('clinician should create a patient and admin should delete it', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);

    const randomSuffix = generateRandomSuffix();
    const testEmail = `cross_role_${randomSuffix}@example.com`;
    const redcapId = randomSuffix;

    // --- STEP 1: Creation of the patient by CLINICIAN ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.CLINICIAN_USER!);
    await loginPage.enterPassword(process.env.CLINICIAN_PASSWORD!);
    await expect(page).toHaveURL(/.*clinician/, { timeout: 15000 });

    const addBtn = page.locator('a[href="/clinician/addpatient"]:has-text("Add Patient")');
    await addBtn.click();
    
    await adminPage.fillPatientData({
      first: firstName,
      last: lastName,
      email: testEmail,
      sex: 'Female',
      phone: '999888777666',
      redcap: redcapId,
      mrn: testMRN,
      clinic: 'Nick Clinic#1',
      lang: 'English',
      uncheckSms: true 
    });

    await adminPage.submitForm(/\/clinician$/);

    // Verify presence as Clinician
    const patientRow = page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await expect(patientRow).toBeVisible({ timeout: 10000 });
    
    // --- STEP 2: Removing of the patient by ADMIN ---
    console.log(`Switching to Admin for cleanup. Target: ${testEmail}`);
    
    // Step 2.1: Secure Logout
    await page.goto('/logout');
    await page.context().clearCookies();
    await page.goto('/').catch(() => {});
    
    // Wait for the login page to load properly and ensure URL contains "login"
    await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
    await expect(loginPage.usernameInput).toBeVisible({ timeout: 10000 });

    // Step 2.2: Login as Admin
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/.*admin/, { timeout: 15000 });
    

    // Step 2.3: Sort and Delete the record
    await adminPage.goToPatients();
    const firstNameSortBtn = page.getByRole('button', { name: 'First Name' });
    await firstNameSortBtn.click();
    await page.waitForLoadState('networkidle');
    await adminPage.deletePatientByName(firstName, lastName);
    
    // Step 2.4: Final verification
    await expect(patientRow).not.toBeVisible({ timeout: 10000 });
    
    console.log('Success: Patient created by Clinician and removed by Admin.');
  });
});