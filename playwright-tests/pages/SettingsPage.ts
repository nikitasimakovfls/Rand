import { Page, Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly settingsNavLink: Locator;
  readonly languageDropdown: Locator;
  readonly pageTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locate settings button which can be either "Settings" or "Configuración"
    this.settingsNavLink = page.locator('a.nav-item').filter({ hasText: /Settings|Configuración/ });
    this.languageDropdown = page.locator('.language-dropdown button.dropdown-toggle');
    this.pageTitle = page.locator('h1.page-title');
  }

  /**
   * Navigate to the Settings page and verify the title is visible
   */
  async goToSettings() {
    await this.settingsNavLink.waitFor({ state: 'visible' });
    const currentLinkText = await this.settingsNavLink.innerText();
    console.log(`Current language detected by nav link: ${currentLinkText}`);
    
    await this.settingsNavLink.click();
    await this.page.waitForURL('**/settings');
    // Wait for the page title to load (either English or Spanish version)
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Open the language dropdown and select the target language
   */
  async switchLanguage(targetLang: 'English' | 'Spanish') {
    await this.languageDropdown.click();
    
    // Select language option from the visible dropdown menu
    const option = this.page.locator(`.dropdown-menu.show >> text="${targetLang}"`);
    await option.waitFor({ state: 'visible' });
    await option.click();
    
    // Verify the dropdown menu is closed
    await expect(this.page.locator('.dropdown-menu.show')).not.toBeVisible();
  }
}