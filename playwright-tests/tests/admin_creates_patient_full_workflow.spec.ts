import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix } from '../utils/helpers';

test.describe('Admin creates patient full workflow', () => {

  test('Admin creates a Patient, Patient activates account via email, then Admin deletes this Patient', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginPage = new LoginPage(page);
    const adminPage = new AdminPage(page);

    test.setTimeout(240000);

    // --- STEP 1: Email Generation via Mail7 UI ---
    const suffix = generateRandomSuffix();
    const patientUsername = `itreat_test_${suffix}`;
    const mail7Page = await context.newPage();
    await mail7Page.goto('https://portal.mail7.app/');
    const mailInput = mail7Page.locator('input[placeholder="username"]');
    await mailInput.fill(patientUsername);
    await mail7Page.keyboard.press('Enter');
    const fullTestEmail = await mailInput.getAttribute('value');
    if (!fullTestEmail) throw new Error('Failed to retrieve email from Mail7 UI');
    
    console.log(`[Mail7] Generated email address: ${fullTestEmail}`);

    // --- STEP 2: Admin Creates Patient ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await page.keyboard.press('Enter');
    
    await adminPage.goToPatients();
    await adminPage.openAddPatientForm();
    const firstName = `1_PAT_${suffix}`;
    const lastName = `1_PAT_${suffix}`;
    const fullName = `${firstName} ${lastName}`; 

    await adminPage.fillPatientData({
      first: firstName,
      last: lastName,
      email: fullTestEmail,
      sex: 'Male',
      phone: '1234567890',
      redcap: suffix,
      mrn: `MRN_${suffix}`,
      clinic: 'Regression Clinic',
      lang: 'English',
      uncheckSms: true 
    });
  
    await adminPage.markAsTestUser();
    
    await Promise.all([
      page.waitForResponse(response => 
        response.url().includes('/admin/patient') && 
        response.status() === 200,
        { timeout: 30000 }
      ),
      adminPage.finalAddButton.click()
    ]);
  
  
    await adminPage.sortByFirstName();
    
    const initialPatientRow = page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await expect(initialPatientRow).toBeVisible({ timeout: 15000 });



    const resendButton = initialPatientRow.getByRole('button', { name: 'Re-send Email' });
    await expect(resendButton).toBeVisible();
    await resendButton.click();
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal).toContainText('Send invitation email to patient?');


    await modal.getByRole('button', { name: 'Send' }).click();
    
    
    await expect(modal).toBeHidden();

    await test.step('We really need this pause here to separate two emails in Mail7 box by time', async () => {
      await page.waitForTimeout(15000);
    });


    console.log(`[Admin] Patient ${fullTestEmail} created and verified`);





    // --- STEP 3: Scheduling (Weekly ACM) ---
    await page.getByRole('link', { name: 'Schedule' }).click();
    await page.getByRole('link', { name: 'Add' }).click();

    const patientSelect = page.locator('select#patientId');
    await expect(patientSelect).toContainText(fullName, { timeout: 10000 });
    await patientSelect.selectOption({ label: fullName });
    await page.locator('select#templateId').selectOption({ label: 'Weekly ACM' });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); 
    
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const year = yesterday.getFullYear();
    const yesterdayDateString = `${month}/${day}/${year} 08:00 AM`;

    const dateInput = page.locator('.react-datepicker__input-container input');
    await dateInput.click();
    await dateInput.clear();

    await page.keyboard.press('CapsLock');
    await dateInput.pressSequentially(yesterdayDateString, { delay: 100 });
    await page.keyboard.press('CapsLock');

    await page.keyboard.press('Enter', { delay: 100 });
    await page.keyboard.press('Enter', { delay: 100 });
    await page.keyboard.press('Enter', { delay: 100 });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add' }).click();

    console.log(`[Admin] Weekly ACM scheduled`);

    // --- STEP 4: Admin Sign Out ---
    await page.locator('li.nav-item').getByRole('link', { name: 'Sign out' }).click();
    await loginPage.usernameInput.waitFor({ state: 'visible' });
    await context.clearCookies(); 

    console.log(`[Admin] Logged Out`);



    // --- STEP 5: Wait for Welcome Email in Mail7 ---
    await mail7Page.bringToFront();
    const welcomeSubject = 'Welcome to CareConnexus and iTREAT';
    const questionnaireSubject = 'CareConnexUs Questionnaire from Your Doctor';
    const welcomeEmail = mail7Page.locator('.MuiListItemText-root', { hasText: welcomeSubject }).first();
    const questionnaireEmail = mail7Page.locator('.MuiListItemText-root', { hasText: questionnaireSubject }).first();

    await test.step('Verify both Welcome and Questionnaire emails are received', async () => {
      await Promise.all([
        expect(welcomeEmail).toBeVisible({ timeout: 90000 }),
        expect(questionnaireEmail).toBeVisible({ timeout: 90000 })
      ]);
      console.log('[Mail7] Both Welcome AND Questionnaire emails are found');
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

    console.log(`[Patient] Logged In with password changed`);

    await page.locator('h1.page-title', { hasText: 'End User License Agreement' }).waitFor({ state: 'visible' });
    await page.locator('#licenseAgreement').check();
    await page.getByRole('button', { name: 'Save' }).click();

    console.log(`[Patient] Agreed EULA`);

    // Questionnaire Baseline
    await page.locator('.header-nav-title', { hasText: 'Weekly Asthma Questionnaire' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    const answers = ['Not at all', 'Never', 'Not at all', 'Never', 'Not at all'];
    for (let i = 0; i < answers.length; i++) {
      await page.locator('label', { hasText: answers[i] }).click();
      if (i === answers.length - 1) {
        await page.getByRole('button', { name: 'Done' }).click();
      } else {
        await page.getByRole('button', { name: 'Next' }).click();
      }
    }

    await page.getByRole('button', { name: 'Submit' }).click();
    await page.locator('h2', { hasText: 'Baseline complete!' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Done' }).click();

    console.log(`[Patient] Filled In Baseline Questionnaire`);

    // --- STEP 7: Second Questionnaire (Scheduled) ---
    await expect(page).toHaveURL(/.*questionnaire/, { timeout: 15000 });
    const beginButton = page.locator('.list-item-suffix').getByRole('button', { name: 'BEGIN' });
    await beginButton.click();

    await page.locator('.header-nav-title', { hasText: 'Weekly Asthma Questionnaire' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();

    const steps = ['Once or twice', 'Hardly ever', 'A little', 'Once', 'Once or twice'];
    for (let i = 0; i < steps.length; i++) {
      await page.locator('label', { hasText: steps[i] }).click();
      await page.getByRole('button', { name: i === 4 ? 'Done' : 'Next' }).click();
    }

    await page.locator('.modal-content').getByRole('button', { name: 'Submit' }).click();

    // Call Me Flow
    await page.locator('h1.page-title', { hasText: 'Questionnaire Results' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Call me' }).click();
    await page.locator('label', { hasText: 'I missed some doses' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Change number' }).click();

    const phoneInput = page.locator('input#phone');
    await phoneInput.clear();
    await phoneInput.fill('666666666');
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('.list-item-content', { hasText: 'View my asthma data' }).click();

    console.log(`[Patient] Filled In Weekly ACM Questionnaire`);

    // --- STEP 8: Patient Logout ---
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(loginPage.usernameInput).toBeVisible();
    await context.clearCookies();

    // --- STEP 8.5: Clinician Verification ---
    await test.step('Clinician verifies callback request', async () => {
      const clinicianContext = await browser.newContext();
      const clinicianPage = await clinicianContext.newPage();
      const clinicianLogin = new LoginPage(clinicianPage);
      await clinicianPage.goto('/');
      await clinicianLogin.enterUsername(process.env.CLINICIAN_USER!);
      await clinicianLogin.enterPassword(process.env.CLINICIAN_PASSWORD!);
      await clinicianPage.keyboard.press('Enter');
      const clinicianPatientRow = clinicianPage.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
      await expect(clinicianPatientRow).toBeVisible({ timeout: 15000 });
      await clinicianPatientRow.getByRole('link', { name: 'Graph' }).click();
      await expect(clinicianPage.locator('h3.pageHeader')).toContainText('Phone: 666666666');
      await clinicianPage.getByRole('button', { name: 'Mark as called' }).click();
      await clinicianPage.locator('.modal-content').getByRole('button', { name: 'Confirm' }).click();
      await clinicianPage.getByRole('link', { name: 'Patients' }).click();
      const iconTitle = clinicianPage.locator('tr').filter({ hasText: firstName }).locator('svg[data-icon="phone"] title');
      await expect(iconTitle).toHaveText('Call Completed');
      await clinicianContext.close();
    });

    // --- STEP 9: Admin Cleanup ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.ADMIN_USER!);
    await loginPage.enterPassword(process.env.ADMIN_PASSWORD!);
    await page.keyboard.press('Enter');
    await adminPage.goToPatients();
    await adminPage.sortByFirstName();
    const finalCleanupRow = page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await expect(finalCleanupRow).toBeVisible({ timeout: 15000 });
    await adminPage.deletePatientByName(firstName, lastName);
    await expect(finalCleanupRow).not.toBeVisible({ timeout: 10000 });
    
    console.log(`[Admin] Patient ${fullTestEmail} successfully removed\n`);
    console.log(`✅ [Success] Test completed\n`);
    
    await context.close();
  });
});