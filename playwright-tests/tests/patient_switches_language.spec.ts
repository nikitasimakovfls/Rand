import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage } from '../pages/SettingsPage';

test.describe('Patient checks Language toggling', () => {

  test('Patient detects current language and toggle it correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const settingsPage = new SettingsPage(page);

    const baseURL = test.info().project.use.baseURL;
    const hostname = baseURL ? new URL(baseURL).host : 'unknown';
    console.log(`\n🚀 [Service] Running tests on host: ${hostname}\n`);

    // --- Step 1: Authentication ---
    await page.goto('/');
    await loginPage.enterUsername(process.env.PATIENT_USER!);
    await loginPage.enterPassword(process.env.PATIENT_PASSWORD!);

    console.log(`[Patient] Loged In`);

    // --- Step 2: Navigation ---
    await settingsPage.goToSettings();

    // --- Step 3: Conditional Language Toggling ---
    // Determine the initial language state by checking the page title
    const currentTitle = await settingsPage.pageTitle.innerText();
    console.log(`[Service] Detected initial page title: "${currentTitle.trim()}"`);

    if (currentTitle.trim() === 'Settings') {
      // PATH A: Language is English -> Switch to Spanish
      console.log('[Service] Current language is English. Switching to Spanish...');
      await settingsPage.switchLanguage('Spanish');
      
      // Verify localization change
      await expect(settingsPage.pageTitle).toHaveText('Configuración', { timeout: 10000 });
      console.log('[Service] Successfully toggled English -> Spanish');

    } else if (currentTitle.trim() === 'Configuración') {
      // PATH B: Language is Spanish -> Switch to English
      console.log('[Service] Current language is Spanish. Switching to English...');
      await settingsPage.switchLanguage('English');
      
      // Verify localization change
      await expect(settingsPage.pageTitle).toHaveText('Settings', { timeout: 10000 });
      console.log('[Service] Successfully toggled Spanish -> English');

    } else {
      // Fail the test if the title doesn't match known localizations
      throw new Error(`[Service] Unexpected page title detected: "${currentTitle}"`);
    }
    
    console.log(`[Patient] Language toggle test completed successfully\n`);
    console.log(`✅ [Success] Test completed\n`);

  });
});