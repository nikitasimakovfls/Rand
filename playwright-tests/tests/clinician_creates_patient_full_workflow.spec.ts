import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix, MailApi } from '../utils/helpers';
import { DateTime } from 'luxon';

test.describe('Clinician creates a Patient, full workflow', () => {

  test('Clinician creates a Patient, verifies double welcome email, activates account, then Admin deletes Patient', async ({ browser }) => {
    test.setTimeout(120000);

    const suffix = generateRandomSuffix();
    const patientInitialPass = 'Qwerty123';
    const firstName = `1_PAT_CLIN_${suffix}`;
    const lastName = `1_PAT_CLIN_${suffix}`;

    const baseURL = test.info().project.use.baseURL;
    const hostname = baseURL ? new URL(baseURL).host : 'unknown';
    console.log(`\n🚀 [Service] Running tests on host: ${hostname}\n`);
    
    // --- STEP 1: Email Prep via API ---
    const domain = await MailApi.getFirstDomain();
    const fullTestEmail = `test_clin_${suffix}@${domain}`;
    await MailApi.createAccount(fullTestEmail, patientInitialPass);
    const mailToken = await MailApi.getToken(fullTestEmail, patientInitialPass);

    // --- SETUP: Contexts ---
    const clinicianContext = await browser.newContext();
    const clinicianPageObj = new AdminPage(await clinicianContext.newPage());
    const clinicianLogin = new LoginPage(clinicianPageObj.page);

    const patientContext = await browser.newContext();
    const patientPage = await patientContext.newPage();
    const patientLogin = new LoginPage(patientPage);

    console.log(`[Service] Created Email: ${fullTestEmail}`);

    // --- STEP 2: Clinician Actions (Create Patient) ---
    await clinicianPageObj.page.goto('/');
    await clinicianLogin.enterUsername(process.env.CLINICIAN_USER!);
    await clinicianLogin.enterPassword(process.env.CLINICIAN_PASSWORD!);
    await clinicianPageObj.page.keyboard.press('Enter');
    
    const addBtn = clinicianPageObj.page.locator('a:has-text("Add Patient")');
    await addBtn.click();

    await clinicianPageObj.fillPatientData({
      first: firstName,
      last: lastName,
      email: fullTestEmail,
      sex: 'Male',
      phone: '1234567890',
      redcap: suffix,
      mrn: `MRN_${suffix}`,
      clinic: 'Regression Clinic (EU)',
      lang: 'English',
      uncheckSms: true 
    });
    await clinicianPageObj.markAsTestUser();
    
    await Promise.all([
      clinicianPageObj.page.waitForResponse(r => r.url().includes('/clinician') && r.status() === 200),
      clinicianPageObj.finalAddButton.click()
    ]);

    // --- STEP 2.5: Resend Welcome Email by Clinician ---
    if (await clinicianPageObj.page.url().includes('add-patient')) {
        await clinicianPageObj.page.goto('/clinician');
    }
    await clinicianPageObj.sortByName();
    
    const initialPatientRow = clinicianPageObj.page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
    await initialPatientRow.getByRole('button', { name: 'Re-send Email' }).click();
    
    const modal = clinicianPageObj.page.locator('.modal-content');
    await modal.getByRole('button', { name: 'Send' }).click();
    await expect(modal).toBeHidden();

    console.log(`[Clinician] Patient created and welcome email re-sent`);

    // --- STEP 3: API - Verify 2 Welcome Emails and Extract OTP ---
    const welcomeEmail = await MailApi.waitForMessage(mailToken, 'Welcome to CareConnexus', 2);
    
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
        console.error('Email content for debug:', rawContent);
        throw new Error('[Service] OTP not found in the latest email');
    }

    const tempPassword = passwordMatch[1].trim().replace(/[.,!?;]$/, '');
    console.log(`[Service] Extracted OTP: ${tempPassword}`);

    // --- STEP 4: Patient Actions (Activation & Baseline) ---
    await patientPage.goto('/');
    await patientLogin.enterUsername(fullTestEmail);
    await patientLogin.enterPassword(tempPassword);
    await patientPage.keyboard.press('Enter');

    const newPassword = 'Qwerty123';
    await patientPage.getByRole('heading', { name: 'Change password' }).waitFor({ state: 'visible' });
    await patientPage.locator('input[name="password"]').fill(newPassword);
    await patientPage.locator('input[name="confirmPassword"]').fill(newPassword);
    await patientPage.keyboard.press('Enter');

    await patientPage.locator('#licenseAgreement').check();
    await patientPage.getByRole('button', { name: 'Save' }).click();

    // Baseline Flow
    await patientPage.getByRole('button', { name: 'Next' }).click();
    await patientPage.getByRole('button', { name: 'Next' }).click();
    const baselineAnswers = ['Not at all', 'Never', 'Not at all', 'Never', 'Not at all'];
    for (const ans of baselineAnswers) {
      await patientPage.locator('label', { hasText: ans }).click();
      await patientPage.getByRole('button', { name: /Next|Done/ }).click();
    }
    await patientPage.getByRole('button', { name: 'Submit' }).click();
    await patientPage.getByRole('button', { name: 'Done' }).click();

    console.log(`[Patient] Baseline complete`);

    // --- STEP 4.2: Verify Upcoming Questionnaire Time ---
    const upcomingItem = patientPage.locator('.list-item', { hasText: /Questionnaire/i });
    await expect(upcomingItem).toBeVisible({ timeout: 10000 });

    const upcomingText = await upcomingItem.locator('.list-item-content').innerText();
    
    // 1. Calculate Expected Time using Config Timezone
    const tz = (test.info().project.use.timezoneId as string) || 'UTC';
    const nowInTz = DateTime.now().setZone(tz);
    
    // Schedule: Tuesday at 10:00 AM
    let nextOccurrence = nowInTz.set({ weekday: 2, hour: 10, minute: 0, second: 0, millisecond: 0 });
    
    // Target next week if current time is past Tuesday 10 AM
    if (nowInTz > nextOccurrence) {
        nextOccurrence = nextOccurrence.plus({ weeks: 1 });
    }
    
    const diff = nextOccurrence.diff(nowInTz, ['days', 'hours']).toObject();
    const expectedHoursTotal = (Math.floor(diff.days || 0) * 24) + Math.floor(diff.hours || 0);

    console.log(`[Patient] Upcoming questionnaire: "${upcomingText.trim()}"`);
    console.log(`[Service] Target Timezone (${tz}): ${nowInTz.toFormat('HH:mm')}, Expected in: ${expectedHoursTotal}h`);

    // 2. Parse UI Text
    // Regex covers: Days and Hours, only Hours, "an hour", or "less than an hour"
    const timeMatch = upcomingText.match(/in (\d+) days and (\d+) hours|in (\d+) hours|(less than an|an) hour/i);

    let actualHoursTotal: number;

    if (timeMatch) {
        if (timeMatch[4]) {
            // "an hour" -> 1, "less than an hour" -> 0
            actualHoursTotal = timeMatch[4].toLowerCase().includes('an') ? 1 : 0;
        } else if (timeMatch[3]) {
            // e.g. "in 13 hours"
            actualHoursTotal = parseInt(timeMatch[3]);
        } else if (timeMatch[1] && timeMatch[2]) {
            // e.g. "in 1 days and 13 hours"
            actualHoursTotal = (parseInt(timeMatch[1]) * 24) + parseInt(timeMatch[2]);
        } else {
            actualHoursTotal = 0;
        }
    } else if (upcomingText.match(/[a-zA-Z]{3} \d{1,2}/)) {
        // CASE 3: Only date present (e.g., "Feb 16"), meaning < 1 hour remains
        console.log(`[Service] Only date detected ("${upcomingText.trim()}"), assuming < 1h remaining.`);
        actualHoursTotal = 0;
    } else {
        throw new Error(`[Service] Could not parse upcoming time: "${upcomingText}"`);
    }

    console.log(`[Service] Parsed UI: ${actualHoursTotal}h`);

    // 3. Validation with 1h rounding tolerance
    expect(actualHoursTotal).toBeGreaterThanOrEqual(expectedHoursTotal - 1);
    expect(actualHoursTotal).toBeLessThanOrEqual(expectedHoursTotal);

    // --- STEP 5: Clinician triggers Password Reset & Verify Link ---
    await clinicianPageObj.page.bringToFront();
    await clinicianPageObj.page.goto('/clinician');
    await clinicianPageObj.sortByName();
    
    const patientRowAfterActivation = clinicianPageObj.page.locator('tr').filter({ hasText: firstName });
    await patientRowAfterActivation.getByRole('button', { name: 'Re-send Email' }).click();

    const resetModal = clinicianPageObj.page.locator('.modal-content');
    await expect(resetModal).toBeVisible();
    await resetModal.getByRole('button', { name: 'Send' }).click();

    const resetEmail = await MailApi.waitForMessage(mailToken, 'Password Reset Requested');
    
    const currentHost = new URL(clinicianPageObj.page.url()).host;
    const htmlContent = Array.isArray(resetEmail.html) ? resetEmail.html[0] : resetEmail.html;
    expect(htmlContent).toContain(currentHost);

    console.log(`[Clinician] Reset link verified via API on host: ${currentHost}`);

    // --- STEP 6: Admin Cleanup ---
    const adminContext = await browser.newContext();
    const adminPageObj = new AdminPage(await adminContext.newPage());
    const adminLogin = new LoginPage(adminPageObj.page);

    await adminPageObj.page.goto('/');
    await adminLogin.enterUsername(process.env.ADMIN_USER!);
    await adminLogin.enterPassword(process.env.ADMIN_PASSWORD!);
    await adminPageObj.page.keyboard.press('Enter');

    await adminPageObj.goToPatients();
    await adminPageObj.sortByName();
    await adminPageObj.deletePatientByName(firstName, lastName);
    
    await expect(adminPageObj.page.locator('tr').filter({ hasText: firstName })).not.toBeVisible();

    await clinicianContext.close();
    await patientContext.close();
    await adminContext.close();

    console.log(`[Admin] Patient ${fullTestEmail} successfully removed\n`);
    console.log(`✅ [Success] Test completed\n`);
  });
});