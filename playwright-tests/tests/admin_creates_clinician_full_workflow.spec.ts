import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { generateRandomSuffix, MailApi } from '../utils/helpers'; 

test.describe('Admin creates a Clinician, full workflow', () => {

  test('Admin creates a Clinician, Clinician activates account, Admin deletes Clinician', async ({ browser }) => {
    test.setTimeout(90000);

    const suffix = generateRandomSuffix();
    const clinicianPass = 'Qwerty123';

    const baseURL = test.info().project.use.baseURL;
    const hostname = baseURL ? new URL(baseURL).host : 'unknown';
    console.log(`\n🚀 [Service] Running tests on host: ${hostname}\n`);
    
    // --- STEP 1: Email Prep via API ---
    const domain = await MailApi.getFirstDomain();
    const fullTestEmail = `test_${suffix}@${domain}`;
    await MailApi.createAccount(fullTestEmail, clinicianPass);
    const mailToken = await MailApi.getToken(fullTestEmail, clinicianPass);

    // --- SETUP: Contexts ---
    const adminContext = await browser.newContext();
    const adminPageObj = new AdminPage(await adminContext.newPage());
    const adminLogin = new LoginPage(adminPageObj.page);

    const clinicianContext = await browser.newContext();
    const clinicianPage = await clinicianContext.newPage();
    const clinicianLogin = new LoginPage(clinicianPage);

    console.log(`[Service] Created Email: ${fullTestEmail} and context`);

    // --- STEP 2: Admin Actions (Create Clinician) ---
    await adminPageObj.page.goto('/');
    await adminLogin.enterUsername(process.env.ADMIN_USER!);
    await adminLogin.enterPassword(process.env.ADMIN_PASSWORD!);
    await adminPageObj.goToClinicians();
    await adminPageObj.openAddClinicianForm();
    await adminPageObj.fillClinicianData(`1_A_Doc_${suffix}`, fullTestEmail);
    await adminPageObj.markAsTestUser();
    await adminPageObj.addClinicToClinician();

    await Promise.all([
      adminPageObj.page.waitForResponse(r => r.url().includes('/admin/clinicians') && r.status() === 200),
      adminPageObj.finalAddButton.click()
    ]);

    // --- Resend Invite ---
    await adminPageObj.sortByName();
    const row = adminPageObj.page.locator('tr').filter({ hasText: fullTestEmail });
    await row.getByRole('button', { name: 'Re-send Email' }).click();
    const modal = adminPageObj.page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Send' }).click();
    await expect(modal).toBeHidden();

    console.log(`[Admin] Clinician created, verified, Welcome message sent again`);

    // --- STEP 3: API - Get Password from Welcome Email ---
    const welcomeEmail = await MailApi.waitForMessage(mailToken, 'Welcome to CareConnexus', 2);
    const rawContent = welcomeEmail.text || (Array.isArray(welcomeEmail.html) ? welcomeEmail.html[0] : welcomeEmail.html);
    const passwordMatch = rawContent.match(/temporary password:\s*([^<\s]+)/i);
    if (!passwordMatch) throw new Error('OTP not found in the latest email');
    const tempPassword = passwordMatch[1].trim().replace(/[.,!]$/, '');

    console.log(`[Service] Extracted OTP: ${tempPassword}`);

    // --- STEP 4: Clinician Actions ---
    await clinicianPage.goto('/');
    await clinicianLogin.enterUsername(fullTestEmail);
    await clinicianLogin.enterPassword(tempPassword);
    await clinicianPage.keyboard.press('Enter');

    const newPassword = 'Qwerty123!';
    await clinicianPage.getByRole('heading', { name: 'Change password' }).waitFor({ state: 'visible' });
    await clinicianPage.locator('input[name="password"]').fill(newPassword);
    await clinicianPage.locator('input[name="confirmPassword"]').fill(newPassword);
    await clinicianPage.keyboard.press('Enter');

    await expect(clinicianPage).toHaveURL(/.*clinician/, { timeout: 20000 });

    console.log(`[Clinician] Logged In with password changed`);

    // --- STEP 5: Admin triggers Password Reset & Verify Email via API ---
    await adminPageObj.page.bringToFront();
    const clinicianRow = adminPageObj.page.locator('tr').filter({ hasText: fullTestEmail });
    await clinicianRow.getByRole('button', { name: 'Re-send Email' }).click();

    const confirmModal = adminPageObj.page.locator('.modal-content');
    await confirmModal.getByRole('button', { name: 'Send' }).click();

    const resetEmail = await MailApi.waitForMessage(mailToken, 'Password Reset Requested');
    const currentHost = new URL(adminPageObj.page.url()).host;
    
    const htmlContent = Array.isArray(resetEmail.html) ? resetEmail.html[0] : resetEmail.html;
    expect(htmlContent).toContain(currentHost);

    console.log(`[Admin] Reset email verified via API for host: ${currentHost}`);

    // --- STEP 6: Admin Cleanup ---
    await adminPageObj.page.reload(); 
    await adminPageObj.goToClinicians();
    await adminPageObj.sortByName();
    await adminPageObj.deleteClinicianByEmail(fullTestEmail);
    
    await expect(adminPageObj.page.locator('tr').filter({ hasText: fullTestEmail })).not.toBeVisible();

    await adminContext.close();
    await clinicianContext.close();

    console.log(`[Admin] Clinician ${fullTestEmail} successfully removed\n`);
    console.log(`✅ [Success] Test completed\n`);

  });
});