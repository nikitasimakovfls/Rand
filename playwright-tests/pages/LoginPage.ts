import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly nextButton: Locator;
  readonly passwordInput: Locator;
  readonly continueButton: Locator;
  readonly emailError: Locator;
  readonly authError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.nextButton = page.locator('button[type="submit"]:has-text("Next")');
    this.passwordInput = page.locator('input[name="password"]');
    this.continueButton = page.locator('button[type="submit"]:has-text("Continue")');
    
    // Error locators
    this.emailError = page.locator('span.awsui_error__message_14mhv_8dwez_338');
    this.authError = page.locator('[id^="form-error-"]');
  }

  /**
   * Enter email/username and proceed to password step
   */
  async enterUsername(username: string) {
    await this.usernameInput.waitFor({ state: 'visible' });
    await this.usernameInput.fill(username);
    await this.nextButton.click();

    // Check for email format validation error immediately after clicking Next
    if (await this.emailError.isVisible()) {
        const text = await this.emailError.innerText();
        throw new Error(`Step 1 Failed: ${text}`);
    }
  }

  /**
   * Enter password and complete authentication
   */
  async enterPassword(password: string) {
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.fill(password);
    await this.continueButton.click();

    // Small delay to allow DOM update if an error appears
    await this.page.waitForTimeout(500);

    // Check for invalid login/password pair error
    if (await this.authError.isVisible()) {
        const text = await this.authError.innerText();
        throw new Error(`Step 2 Failed: ${text}`);
    }
  }
}