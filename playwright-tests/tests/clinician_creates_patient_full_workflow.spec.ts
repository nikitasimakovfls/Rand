import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix } from '../utils/helpers';

test.describe('Clinician creates patient full workflow', () => {
  
  test('Clinician creates a Patient, Patient activates account via email, then Admin deletes this Patient', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);
    
    const suffix = generateRandomSuffix();
    const firstName = `1_PAT_${suffix}`;
    const lastName = `1_PAT_${suffix}`;
    const testMRN = `MRN_${suffix}`;
    const patientUsername = `itreat_test_${suffix}`;
    
    // Увеличиваем таймаут для длинного сценария
    test.setTimeout(240000);

    // --- STEP 1: Email Generation via Mail7 UI ---
    const mail7Page = await context.newPage();
    await mail7Page.goto('https://portal.mail7.app/');
    const mailInput = mail7Page.locator('input[placeholder="username"]');
    await mailInput.fill(patientUsername);
    await mail7Page.keyboard.press('Enter');
    const fullTestEmail = await mailInput.getAttribute('value');
    if (!fullTestEmail) throw new Error('Failed to retrieve email from Mail7 UI');
    
    console.log(`[Mail7] Generated email address: ${fullTestEmail}`);

    // --- STEP 2: Clinician Creates Patient ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.CLINICIAN_USER!);
    await loginPage.enterPassword(process.env.CLINICIAN_PASSWORD!);
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL(/.*clinician/, { timeout: 15000 });
    const addBtn = page.locator('a:has-text("Add Patient")');
    await addBtn.click();
    
    await adminPage.fillPatientData({
      first: firstName,
      last: lastName,
      email: fullTestEmail,
      sex: 'Male',
      phone: '111111111',
      redcap: suffix,
      mrn: testMRN,
      clinic: 'Regression Clinic',
      lang: 'English',
      uncheckSms: true 
    });
    
    await adminPage.markAsTestUser();

    await Promise.all([
      page.waitForResponse(response => 
        response.url().includes('/clinician') && 
        response.status() === 200,
        { timeout: 30000 }
      ),
      adminPage.finalAddButton.click()
    ]);

    await adminPage.sortByFirstName();

    const initialPatientRow = page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await expect(initialPatientRow).toBeVisible({ timeout: 15000 });

    console.log(`[Clinician] Patient ${fullTestEmail} created and verified`);
    
    // --- STEP 3: Clinician Sign Out ---
    await page.locator('li.nav-item').getByRole('link', { name: 'Sign out' }).click();
    await loginPage.usernameInput.waitFor({ state: 'visible' });
    await context.clearCookies();

    console.log(`[Clinician] Logged Out`);

    // --- STEP 5: Wait for Welcome Email in Mail7 ---
    await mail7Page.bringToFront();
    const welcomeSubject = 'Welcome to CareConnexus and iTREAT';
    const welcomeEmail = mail7Page.locator('.MuiListItemText-root', { hasText: welcomeSubject }).first();

    await test.step('Verify Welcome email is received', async () => {
      await expect(welcomeEmail).toBeVisible({ timeout: 90000 });
    });

    await welcomeEmail.click();
    const emailContent = mail7Page.locator('div', { hasText: 'temporary password:' }).last();
    await expect(emailContent).toBeVisible({ timeout: 20000 });
    const bodyText = await emailContent.innerText();
    const passwordMatch = bodyText.match(/temporary password:\s*([^\s]+)/i);
    if (!passwordMatch) throw new Error('OTP not found in email');
    const tempPassword = passwordMatch[1].trim().replace(/[.,!]$/, '');
    await mail7Page.close();

    console.log(`[Mail7] OTP retrieved: ${tempPassword}`);

    // --- STEP 6: Patient Login and Activation ---
    await page.bringToFront();
    await page.goto('/'); 
    await loginPage.enterUsername(fullTestEmail);
    await loginPage.enterPassword(tempPassword);
    await page.keyboard.press('Enter');
    
    const newPassword = 'Qwerty123';
    await page.getByRole('heading', { name: 'Change password' }).waitFor({ state: 'visible' });
    await page.locator('input[name="password"]').fill(newPassword);
    await page.locator('input[name="confirmPassword"]').fill(newPassword);
    await page.keyboard.press('Enter');
    
    await page.locator('h1.page-title', { hasText: 'End User License Agreement' }).waitFor({ state: 'visible' });
    await page.locator('#licenseAgreement').check();
    await page.getByRole('button', { name: 'Save' }).click();

    console.log(`[Patient] Logged In with password changed`);

    // Questionnaire
    await page.locator('.header-nav-title', { hasText: 'Weekly Asthma Questionnaire' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    const answers = ['Not at all', 'Never', 'Not at all', 'Never', 'Not at all'];
    for (let i = 0; i < answers.length; i++) {
      await page.locator('label', { hasText: answers[i] }).click();
      await page.getByRole('button', { name: i === answers.length - 1 ? 'Done' : 'Next' }).click();
    }

    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    console.log(`[Patient] Filled in Basic Questionnaire`);

    // --- STEP 8: Patient Logout via Settings ---
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(loginPage.usernameInput).toBeVisible();
    await context.clearCookies();

    console.log('[Patient] Logged out');

    // --- STEP 9: Admin Cleanup ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/.*admin/, { timeout: 15000 });
    await adminPage.goToPatients();
    await adminPage.sortByFirstName();
    const finalCleanupRow = page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await expect(finalCleanupRow).toBeVisible({ timeout: 15000 });
    await adminPage.deletePatientByName(firstName, lastName);
    await expect(finalCleanupRow).not.toBeVisible({ timeout: 10000 });
    
    console.log(`[Admin]: Patient ${fullTestEmail} successfully removed\n`);
    console.log(`✅ [Success] Test completed\n`);
    
    await context.close();
  });
});