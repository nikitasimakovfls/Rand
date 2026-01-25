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
    this.emailError = page.locator('span.awsui_error__message_14mhv_8dwez_338');
    this.authError = page.locator('[id^="form-error-"]');
  }

  /**
   * Enters the username/email and proceeds to the password step.
   * Checks for immediate validation errors (e.g., incorrect format).
   */
  async enterUsername(username: string) {
    await this.usernameInput.waitFor({ state: 'visible' });
    await this.usernameInput.fill(username);
    await this.nextButton.click();

    // Check for email format validation error immediately after clicking 'Next'
    if (await this.emailError.isVisible()) {
        const text = await this.emailError.innerText();
        throw new Error(`Step 1 (Username) Failed: ${text}`);
    }
  }

  /**
   * Enters the password and completes the authentication process.
   * Waits for either a successful navigation or an error message to appear.
   */
  async enterPassword(password: string) {
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.fill(password);
    await this.continueButton.click();

    await Promise.race([
      this.authError.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      this.page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {})
    ]);

    if (await this.authError.isVisible()) {
      const text = await this.authError.innerText();
      throw new Error(`Step 2 (Password) Failed: ${text.trim()}`);
    }
  }
}