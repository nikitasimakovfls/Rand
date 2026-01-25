import { Page, Locator, expect } from '@playwright/test';

export class AdminPage {
  readonly page: Page;
  
  // Navigation elements
  readonly cliniciansSidebarLink: Locator;
  readonly patientsSidebarLink: Locator;
  
  // Clinician form elements
  readonly addClinicianButton: Locator;
  readonly nameInput: Locator;
  readonly clinicSelectAddDoctor: Locator;
  readonly getCallbackCheckbox: Locator;
  readonly modalAddClinicButton: Locator;

  // Patient form elements
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly sexSelect: Locator;
  readonly phoneInput: Locator;
  readonly testUserLabel: Locator;
  readonly smsCheckbox: Locator;
  readonly redCapInput: Locator;
  readonly mrnInput: Locator;
  readonly clinicSelect: Locator;
  readonly languageSelect: Locator;

  // Common elements
  readonly finalAddButton: Locator;
  readonly errorMessageList: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Sidebar locators
    this.cliniciansSidebarLink = page.locator('a.sidebarLink[href="/admin/clinicians"]');
    this.patientsSidebarLink = page.locator('a.sidebarLink[href="/admin/patient"]');
    
    // Clinician form locators
    this.addClinicianButton = page.locator('a[href="/admin/clinicians/add"]');
    this.nameInput = page.locator('input#name');
    this.clinicSelectAddDoctor = page.locator('select#id');
    this.getCallbackCheckbox = page.locator('input#isGetCallbackRequests');
    this.modalAddClinicButton = page.locator('.modal-footer button.btn-primary:has-text("Add clinic")');

    // Patient form locators
    this.firstNameInput = page.locator('input#firstName');
    this.lastNameInput = page.locator('input#lastName');
    this.sexSelect = page.locator('select#sex');
    this.phoneInput = page.locator('input#phone');
    this.testUserLabel = page.locator('label[for="testUser"]');
    this.smsCheckbox = page.locator('#smsNotifications');
    this.redCapInput = page.locator('input#redCapStudyId');
    this.mrnInput = page.locator('input#mrn');
    this.clinicSelect = page.locator('select#clinicId');
    this.languageSelect = page.locator('select#language');
    
    // Shared locators
    this.emailInput = page.locator('input#email');
    this.finalAddButton = page.locator('button.btn-primary:has-text("Add")');
    this.errorMessageList = page.locator('ul.list-unstyled');
  }

  // --- Clinician Actions ---

  /**
   * Scrolls to and toggles the 'Test User' checkbox via its label.
   */
  async markAsTestUser() {
    await this.testUserLabel.scrollIntoViewIfNeeded();
    await this.testUserLabel.click();
    await expect(this.page.locator('input#testUser')).toBeChecked();
  }

  async fillClinicianData(name: string, email: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
  }

  /**
   * Handles the 'Add Clinic' modal for a clinician.
   */
  async addClinicToClinician() {
    const addClinicBtn = this.page.getByRole('button', { name: 'Add Clinic' });
    await addClinicBtn.click();
    
    await this.clinicSelectAddDoctor.waitFor({ state: 'visible' });
    await this.clinicSelectAddDoctor.selectOption({ label: 'Regression Clinic' });
    
    const callbackLabel = this.page.locator('label[for="isGetCallbackRequests"]');
    // Toggle callback checkbox if label is visible, otherwise check directly
    if (await callbackLabel.isVisible()) {
        await callbackLabel.click();
    } else {
        await this.getCallbackCheckbox.check();
    }
    
    await this.modalAddClinicButton.click();
    await expect(this.modalAddClinicButton).toBeHidden();
  }

  async goToClinicians() {
    await this.cliniciansSidebarLink.click();
    await expect(this.page).toHaveURL(/.*admin\/clinicians/);
  }

  async openAddClinicianForm() {
    await this.addClinicianButton.click();
  }

  /**
   * Deletes a clinician by email and confirms via modal.
   */
  async deleteClinicianByEmail(email: string) {
    const row = this.page.locator('tr').filter({ hasText: email });
    await row.getByRole('button', { name: /Remove clinician/i }).click();
    
    const modal = this.page.locator('.modal-content');
    await expect(modal).toBeVisible();
    
    await modal.locator('.modal-footer').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(row).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Sorts the clinician table by name and waits for the API response.
   */
  async sortByName() {
    const nameSortBtn = this.page.getByRole('button', { name: 'Name', exact: true });
    await nameSortBtn.waitFor({ state: 'visible' });
    
    await Promise.all([
      this.page.waitForResponse(
        res => res.url().includes('name&sortBy=asc') && res.status() === 200,
        { timeout: 20000 }
      ),
      nameSortBtn.click(),
    ]);
    // Wait for the table to refresh by checking the first row
    await this.page.locator('tr').first().waitFor({ state: 'visible' });
  }

  // --- Patient Actions ---

  async goToPatients() {
    await this.patientsSidebarLink.click();
    await expect(this.page).toHaveURL(/.*admin\/patient/);
    
    // Wait for the loading overlay to disappear if it appears
    const loader = this.page.locator('text=Loading');
    if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(loader).toBeHidden({ timeout: 15000 });
    }
  }

  async openAddPatientForm() {
    await this.page.getByRole('link', { name: 'Add Patient', exact: true }).click();
    await expect(this.page).toHaveURL(/.*patient\/add/);
  }

  async fillPatientData(data: any) {
    await this.firstNameInput.fill(data.first);
    await this.lastNameInput.fill(data.last);
    await this.emailInput.fill(data.email);
    await this.sexSelect.selectOption({ label: data.sex });
    await this.phoneInput.fill(data.phone);
    if (data.uncheckSms) await this.smsCheckbox.uncheck();
    await this.redCapInput.fill(data.redcap);
    await this.mrnInput.fill(data.mrn);
    await this.clinicSelect.selectOption({ label: data.clinic });
    await this.languageSelect.selectOption({ label: data.lang });
  }

  async submitForm(successUrlRegex: RegExp = /.*admin\/patient/) {
    await this.finalAddButton.click();
    await expect(this.page).toHaveURL(successUrlRegex);
  }

  /**
   * Deletes a patient by email (handles browser native dialogs).
   */
  async deletePatientByEmail(email: string) {
    const row = this.page.locator('tr').filter({ hasText: email });
    // Handle native browser 'confirm' dialog
    this.page.once('dialog', dialog => dialog.accept());
    await row.locator('.btn-danger, [title*="Delete"]').click();
    await expect(row).not.toBeVisible();
  }
}