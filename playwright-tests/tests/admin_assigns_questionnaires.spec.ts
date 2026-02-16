import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { LoginPage } from '../pages/LoginPage';

test('Admin schedules questionnaires, patients verifies and admin deletes Weekly ACMs', async ({ browser }) => {
  test.setTimeout(120000);

  // Extract timezones from config
  const euTz = (test.info().project.use as any).euTimezone || 'UTC';
  const usTz = (test.info().project.use as any).usTimezone || 'UTC';

  const patients = [
    {
      fullName: 'Regression Patient EU',
      email: process.env.PATIENT_EU_USER!,
      pass: process.env.PATIENT_EU_PASSWORD!,
      tz: euTz,
      label: `EU (${euTz})`
    },
    {
      fullName: 'Regression Patient US',
      email: process.env.PATIENT_US_USER!,
      pass: process.env.PATIENT_US_PASSWORD!,
      tz: usTz,
      label: `US (${usTz})`
    }
  ];

  const baseURL = test.info().project.use.baseURL;
  const hostname = baseURL ? new URL(baseURL).hostname : 'unknown';
  console.log(`\n🚀 [Service] Running tests on host: ${hostname}\n`);

  // --- STEP 1: ADMIN ASSIGNS QUESTIONNAIRES ---
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const adminLogin = new LoginPage(adminPage);

  await adminPage.goto('/');
  await adminLogin.enterUsername(process.env.ADMIN_USER!);
  await adminLogin.enterPassword(process.env.ADMIN_PASSWORD!);
  await adminPage.keyboard.press('Enter');

  for (const p of patients) {
    console.log(`[Admin] Scheduling questionnaire for ${p.label}`);
    await adminPage.getByRole('link', { name: 'Schedule' }).click();
    await adminPage.getByRole('link', { name: 'Add' }).click();
    
    await adminPage.locator('select#patientId').selectOption({ label: p.fullName });
    await adminPage.locator('select#templateId').selectOption({ label: 'Weekly ACM' });

    const nowInClinic = DateTime.now().setZone(p.tz);
    const yesterday = nowInClinic.minus({ days: 1 });

    await adminPage.locator('.react-datepicker__input-container input').click();
    if (yesterday.month !== nowInClinic.month) {
      await adminPage.locator('.react-datepicker__navigation--previous').click();
    }
    const yesterdayDay = yesterday.day.toString().padStart(2, '0');
    await adminPage.locator(`.react-datepicker__day--0${yesterdayDay}:not(.react-datepicker__day--outside-month)`).first().click();

    await adminPage.locator('.react-datepicker__time-list-item', { hasText: '10:00 AM' }).click();
    await adminPage.getByRole('button', { name: 'Add' }).click();
    await expect(adminPage.locator('h3.pageHeader')).toHaveText(/^Schedule$/, { timeout: 20000 });
  }

  // --- STEP 2: PATIENTS VERIFY TIME ---
  for (const p of patients) {
    const nowInClinic = DateTime.now().setZone(p.tz);
    const expirationTime = nowInClinic.endOf('day');
    const diff = expirationTime.diff(nowInClinic, 'hours').toObject();
    const expectedHours = Math.floor(diff.hours || 0);

    console.log(`[Patient] Logged in as ${p.label} patient`);
    console.log(`[Service] Clinic Local Time: ${nowInClinic.toFormat('HH:mm')}`);
    console.log(`[Service] Expected remaining: ${expectedHours} hours`);

    // Use timezoneId for browser context to ensure internal JS date logic matches
    const patientContext = await browser.newContext({ timezoneId: p.tz });
    const patientPage = await patientContext.newPage();
    const patientLogin = new LoginPage(patientPage);

    await patientPage.goto('/');
    await patientLogin.enterUsername(p.email);
    await patientLogin.enterPassword(p.pass);
    await patientPage.keyboard.press('Enter');

    const expireElement = patientPage.locator('div', { hasText: /expires in/ }).last();
    await expect(expireElement).toBeVisible({ timeout: 15000 });

    const fullText = await expireElement.innerText();
    const match = fullText.match(/expires in (less than an|an|\d+) hours?/i);

    if (match) {
      let actualHours: number;
      const matchedValue = match[1].toLowerCase();

      if (matchedValue === 'less than an') {
        actualHours = 0;
      } else if (matchedValue === 'an') {
        actualHours = 1;
      } else {
        actualHours = parseInt(matchedValue);
      }
      
      console.log(`[Service] Patient sees: ${fullText} (Parsed as: ${actualHours}h)`);
      
      expect(actualHours).toBeGreaterThanOrEqual(expectedHours - 1);
      expect(actualHours).toBeLessThanOrEqual(expectedHours);
    } else {
      throw new Error(`[Error] Could not parse expiration text: "${fullText}"`);
    }
    await patientContext.close();
  }

  // --- STEP 3: REMOVE QUESTIONNAIRES ---
  for (const p of patients) {
    console.log(`[Service] Deleting questionnaire for ${p.fullName}`);
        
    await adminPage.locator('.fa-angle-down').first().click();
    await adminPage.getByText(p.fullName, { exact: true }).click();
    await adminPage.locator('h3.pageHeader', { hasText: 'Schedule' }).click();

    const row = adminPage.locator('tr').filter({ hasText: 'Weekly ACM' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('input[type="checkbox"]').check();

    await adminPage.getByRole('button', { name: 'Delete' }).click();

    const modal = adminPage.locator('.modal-content');
    await expect(modal).toBeVisible();
      
    const yesterdayStr = DateTime.now().setZone(p.tz).minus({ days: 1 }).toFormat('MM/dd/yyyy');
    await modal.locator('input.form-control').fill(yesterdayStr);
    await modal.getByRole('button', { name: 'Delete' }).click();

    await expect(modal).toBeHidden();
    await adminPage.locator('.cross.cross-enabled').click();
  }

  await adminContext.close();
  console.log(`[Admin] Test questionnaires successfully removed\n`);
  console.log(`✅ [Success] Test completed\n`);
});