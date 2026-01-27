import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix, MailApi } from '../utils/helpers';

test.describe('Admin creates a Patient, full workflow', () => {

  test('Admin creates a Patient, Patient activates account, then Admin deletes Patient', async ({ browser }) => {
    test.setTimeout(90000);

    const suffix = generateRandomSuffix();
    const patientInitialPass = 'Qwerty123';
    const firstName = `1_PAT_${suffix}`;
    const lastName = `1_PAT_${suffix}`;
    const fullName = `${firstName} ${lastName}`;

    const baseURL = test.info().project.use.baseURL;
    const hostname = baseURL ? new URL(baseURL).host : 'unknown';
    console.log(`\n🚀 [Service] Running tests on host: ${hostname}\n`);

    // --- STEP 1: Email Prep via API ---
    const domain = await MailApi.getFirstDomain();
    const fullTestEmail = `test_${suffix}@${domain}`;
    await MailApi.createAccount(fullTestEmail, patientInitialPass);
    const mailToken = await MailApi.getToken(fullTestEmail, patientInitialPass);

    // --- SETUP: Contexts ---
    const adminContext = await browser.newContext();
    const adminPageObj = new AdminPage(await adminContext.newPage());
    const adminLogin = new LoginPage(adminPageObj.page);

    const patientContext = await browser.newContext();
    const patientPage = await patientContext.newPage();
    const patientLogin = new LoginPage(patientPage);

    console.log(`[Service] Created Email: ${fullTestEmail} and context`);

    // --- STEP 2: Admin Actions (Create Patient) ---
    await adminPageObj.page.goto('/');
    await adminLogin.enterUsername(process.env.ADMIN_USER!);
    await adminLogin.enterPassword(process.env.ADMIN_PASSWORD!);
    
    await adminPageObj.goToPatients();
    await adminPageObj.openAddPatientForm();
    await adminPageObj.fillPatientData({
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
    await adminPageObj.markAsTestUser();
    
    await Promise.all([
      adminPageObj.page.waitForResponse(r => r.url().includes('/admin/patient') && r.status() === 200),
      adminPageObj.finalAddButton.click()
    ]);

    // --- STEP 2.5: Resend Invite & Scheduling ---
    await adminPageObj.sortByName();
    const initialPatientRow = adminPageObj.page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    
    // Resend email to test double-receipt logic
    await initialPatientRow.getByRole('button', { name: 'Re-send Email' }).click();
    const modal = adminPageObj.page.locator('.modal-content');
    await modal.getByRole('button', { name: 'Send' }).click();
    await expect(modal).toBeHidden();

    console.log(`[Admin] Patient ${fullTestEmail} created and verified`);

    // Scheduling (Weekly ACM)
    await adminPageObj.page.getByRole('link', { name: 'Schedule' }).click();
    await adminPageObj.page.getByRole('link', { name: 'Add' }).click();
    await adminPageObj.page.locator('select#patientId').selectOption({ label: fullName });
    await adminPageObj.page.locator('select#templateId').selectOption({ label: 'Weekly ACM' });

    // Set date to yesterday to trigger questionnaire immediately
    // --- STEP 2.5: Scheduling (Continued) ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); 
    
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const year = yesterday.getFullYear();
    
    const yesterdayDateString = `${month}/${day}/${year} 08:00 AM`;

    const dateInput = adminPageObj.page.locator('.react-datepicker__input-container input');
    await dateInput.click();
    await dateInput.clear();

    await adminPageObj.page.keyboard.press('CapsLock');
    await dateInput.pressSequentially(yesterdayDateString, { delay: 100 });
    await adminPageObj.page.keyboard.press('CapsLock');

    await adminPageObj.page.keyboard.press('Enter', { delay: 100 });
    await adminPageObj.page.keyboard.press('Enter', { delay: 100 });
    await adminPageObj.page.keyboard.press('Enter', { delay: 100 });
    await adminPageObj.page.keyboard.press('Escape');
    await adminPageObj.page.getByRole('button', { name: 'Add' }).click();

    console.log(`[Admin] Weekly ACM scheduled`);

    // --- STEP 3: API - Get Password and Verify Emails ---
    // Wait for 2 messages because of the Resend step
    const welcomeEmail = await MailApi.waitForMessage(mailToken, 'Welcome to CareConnexus', 2);
    // Also verify that Questionnaire email arrived
    await MailApi.waitForMessage(mailToken, 'Questionnaire from Your Doctor', 1);

    let rawContent = welcomeEmail.text || (Array.isArray(welcomeEmail.html) ? welcomeEmail.html[0] : welcomeEmail.html);

    if (!welcomeEmail.text) {
        rawContent = rawContent
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
    }

    const passwordMatch = rawContent.match(/temporary password:\s*([^<\s\n\r]+)/i);

    if (!passwordMatch) {
        console.error('Full email content for debugging:', rawContent);
        throw new Error('[Service] OTP not found in the latest email');
    }

    const tempPassword = passwordMatch[1].trim().replace(/[.,!?;]$/, '');

    console.log(`[Service] Extracted OTP: ${tempPassword}`);

    // --- STEP 4: Patient Actions (Activation & Questionnaires) ---
    await patientPage.goto('/');
    await patientLogin.enterUsername(fullTestEmail);
    await patientLogin.enterPassword(tempPassword);
    await patientPage.keyboard.press('Enter');

    const newPassword = 'Qwerty123!';
    await patientPage.getByRole('heading', { name: 'Change password' }).waitFor({ state: 'visible' });
    await patientPage.locator('input[name="password"]').fill(newPassword);
    await patientPage.locator('input[name="confirmPassword"]').fill(newPassword);
    await patientPage.keyboard.press('Enter');

    // Agree EULA
    await patientPage.locator('#licenseAgreement').check();
    await patientPage.getByRole('button', { name: 'Save' }).click();

    // Fill Baseline
    await patientPage.getByRole('button', { name: 'Next' }).click();
    await patientPage.getByRole('button', { name: 'Next' }).click();
    const baselineAnswers = ['Not at all', 'Never', 'Not at all', 'Never', 'Not at all'];
    for (const ans of baselineAnswers) {
      await patientPage.locator('label', { hasText: ans }).click();
      await patientPage.getByRole('button', { name: /Next|Done/ }).click();
    }
    await patientPage.getByRole('button', { name: 'Submit' }).click();
    await patientPage.getByRole('button', { name: 'Done' }).click();

    // Fill Scheduled Weekly ACM (triggers Callback)
    await expect(patientPage).toHaveURL(/.*questionnaire/);
    await patientPage.getByRole('button', { name: 'BEGIN' }).click();
    await patientPage.getByRole('button', { name: 'Next' }).click();
    const acmAnswers = ['Once or twice', 'Hardly ever', 'A little', 'Once', 'Once or twice'];
    for (const ans of acmAnswers) {
      await patientPage.locator('label', { hasText: ans }).click();
      await patientPage.getByRole('button', { name: /Next|Done/ }).click();
    }
    await patientPage.locator('.modal-content').getByRole('button', { name: 'Submit' }).click();

    // Call Me Flow
    await patientPage.getByRole('button', { name: 'Call me' }).click();
    await patientPage.locator('label', { hasText: 'I missed some doses' }).click();
    await patientPage.getByRole('button', { name: 'Next' }).click();
    await patientPage.getByRole('button', { name: 'Change number' }).click();
    await patientPage.locator('input#phone').fill('666666666');
    await patientPage.getByRole('button', { name: 'Done' }).click();

    console.log(`[Patient] Activation and Questionnaires complete`);

    // --- STEP 4.5: Admin triggers Password Reset & Verify Email via API ---
    await adminPageObj.page.bringToFront();
    await adminPageObj.goToPatients(); 
    
    const patientRow = adminPageObj.page.locator('tr').filter({ hasText: firstName });
    await patientRow.getByRole('button', { name: 'Re-send Email' }).click();

    const confirmModal = adminPageObj.page.locator('.modal-content');
    await expect(confirmModal).toBeVisible();
    await confirmModal.getByRole('button', { name: 'Send' }).click();

    const resetEmail = await MailApi.waitForMessage(mailToken, 'Password Reset Requested');
    const currentHost = new URL(adminPageObj.page.url()).host;
    
    const htmlContent = Array.isArray(resetEmail.html) ? resetEmail.html[0] : resetEmail.html;
    expect(htmlContent).toContain(currentHost);

    console.log(`[Admin] Reset email for patient verified via API on host: ${currentHost}`);

    // --- STEP 5: Clinician Verification ---
    const clinicianContext = await browser.newContext();
    const clinicianPage = await clinicianContext.newPage();
    const clinicianLogin = new LoginPage(clinicianPage);
    await clinicianPage.goto('/');
    await clinicianLogin.enterUsername(process.env.CLINICIAN_USER!);
    await clinicianLogin.enterPassword(process.env.CLINICIAN_PASSWORD!);
    
    const clinicianPatientRow = clinicianPage.locator('tr').filter({ hasText: firstName });
    await clinicianPatientRow.getByRole('link', { name: 'Graph' }).click();
    await expect(clinicianPage.locator('h3.pageHeader')).toContainText('Phone: 666666666');
    await clinicianPage.getByRole('button', { name: 'Mark as called' }).click();
    await clinicianPage.locator('.modal-content').getByRole('button', { name: 'Confirm' }).click();
    
    await clinicianContext.close();
    
    console.log(`[Clinician] Callback verified`);

    // --- STEP 6: Admin Cleanup ---
    await adminPageObj.page.bringToFront();
    await adminPageObj.goToPatients();
    await adminPageObj.sortByName();
    await adminPageObj.deletePatientByName(firstName, lastName);
    
    await expect(adminPageObj.page.locator('tr').filter({ hasText: firstName })).not.toBeVisible();

    await adminContext.close();
    await patientContext.close();

    console.log(`[Admin] Clinician ${fullTestEmail} successfully removed\n`);
    console.log(`✅ [Success] Test completed\n`);
  });
});