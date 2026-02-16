import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage } from '../pages/SettingsPage';

test.describe('Patient checks Language toggling', () => {

  test('Patient detects current language, toggles it, and resets to English', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const settingsPage = new SettingsPage(page);

    const baseURL = test.info().project.use.baseURL;
    const hostname = baseURL ? new URL(baseURL).host : 'unknown';
    console.log(`\n🚀 [Service] Running tests on host: ${hostname}\n`);

    // --- Step 1: Authentication ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.PATIENT_EU_USER!);
    await loginPage.enterPassword(process.env.PATIENT_EU_PASSWORD!);
    console.log(`[Patient] Logged In`);

    // --- Step 2: Navigation ---
    await settingsPage.goToSettings();

    // --- Step 3: Conditional Language Toggling ---
    let currentTitle = await settingsPage.pageTitle.innerText();
    console.log(`[Service] Detected initial page title: "${currentTitle.trim()}"`);

    if (currentTitle.trim() === 'Settings') {
      // PATH A: English -> Spanish -> English
      console.log('[Service] Current language is English. Switching to Spanish...');
      await settingsPage.switchLanguage('Spanish');
      
      // Verify and log Spanish state
      await expect(settingsPage.pageTitle).toHaveText('Configuración', { timeout: 10000 });
      currentTitle = await settingsPage.pageTitle.innerText();
      console.log(`[Service] Now page title is: "${currentTitle.trim()}"`);

      console.log('[Patient] Resetting language back to English...');
      await settingsPage.switchLanguage('English');

    } else if (currentTitle.trim() === 'Configuración') {
      // PATH B: Spanish -> English
      console.log('[Service] Current language is Spanish. Switching to English...');
      await settingsPage.switchLanguage('English');
    } else {
      throw new Error(`[Service] Unexpected page title detected: "${currentTitle.trim()}"`);
    }

    // --- Final Step: Verification and Final Log ---
    await expect(settingsPage.pageTitle).toHaveText('Settings', { timeout: 10000 });
    const finalTitle = await settingsPage.pageTitle.innerText();
    console.log(`[Service] Final page title: "${finalTitle.trim()}"`);
    
    console.log(`[Service] Language toggle test completed successfully\n`);
    console.log(`✅ [Success] Test completed\n`);
  });
});