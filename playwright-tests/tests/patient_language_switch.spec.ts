import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage } from '../pages/SettingsPage';

test.describe('Universal Language Switch Test', () => {

  test('should detect current language and toggle it', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const settingsPage = new SettingsPage(page);

    await page.goto('/');
    await loginPage.enterUsername(process.env.PATIENT_USER!);
    await loginPage.enterPassword(process.env.PATIENT_PASSWORD!);

    // 1. Navigate to Settings (method handles button text localization)
    await settingsPage.goToSettings();

    // 2. Determine initial language based on the page title
    const currentTitle = await settingsPage.pageTitle.innerText();
    console.log(`Initial page title: ${currentTitle}`);

    if (currentTitle.trim() === 'Settings') {
      // PATH A: Current language is English -> Switch to Spanish
      console.log('Detected English. Switching to Spanish...');
      await settingsPage.switchLanguage('Spanish');
      
      // Verify translation result
      await expect(settingsPage.pageTitle).toHaveText('Configuración', { timeout: 10000 });
      console.log('Successfully toggled English -> Spanish');

    } else if (currentTitle.trim() === 'Configuración') {
      // PATH B: Current language is Spanish -> Switch to English
      console.log('Detected Spanish. Switching to English...');
      await settingsPage.switchLanguage('English');
      
      // Verify translation result
      await expect(settingsPage.pageTitle).toHaveText('Settings', { timeout: 10000 });
      console.log('Successfully toggled Spanish -> English');

    } else {
      throw new Error(`Unexpected page title: ${currentTitle}`);
    }
  });
});