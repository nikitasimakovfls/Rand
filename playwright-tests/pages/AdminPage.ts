import { Page, Locator, expect } from '@playwright/test';

export class AdminPage {
  readonly page: Page;
  // Navigation
  readonly cliniciansSidebarLink: Locator;
  readonly patientsSidebarLink: Locator;
  
  // Clinician form elements
  readonly addClinicianButton: Locator;
  readonly nameInput: Locator;
  readonly clinicSelectAddDoctor: Locator;
  readonly getCallbackCheckbox: Locator;
  readonly modalAddClinicButton: Locator;

  // Patient form elements
  readonly addPatientButton: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly sexSelect: Locator;
  readonly phoneInput: Locator;
  readonly testUserCheckbox: Locator;
  readonly smsCheckbox: Locator;
  readonly redCapInput: Locator;
  readonly mrnInput: Locator;
  readonly clinicSelect: Locator;
  readonly languageSelect: Locator;

  // Common elements
  readonly emailInput: Locator;
  readonly finalAddButton: Locator;
  readonly errorMessageList: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Sidebar links
    this.cliniciansSidebarLink = page.locator('a.sidebarLink[href="/admin/clinicians"]');
    this.patientsSidebarLink = page.locator('a.sidebarLink[href="/admin/patient"]');
    
    // Clinician form elements
    this.addClinicianButton = page.locator('a[href="/admin/clinicians/add"]');
    this.nameInput = page.locator('input#name');
    this.clinicSelectAddDoctor = page.locator('select#id');
    this.getCallbackCheckbox = page.locator('input#isGetCallbackRequests');
    this.modalAddClinicButton = page.locator('.modal-footer button.btn-primary:has-text("Add clinic")');

    // Patient form elements
    this.addPatientButton = page.locator('a[href="/admin/patient/add"]');
    this.firstNameInput = page.locator('input#firstName');
    this.lastNameInput = page.locator('input#lastName');
    this.sexSelect = page.locator('select#sex');
    this.phoneInput = page.locator('input#phone');
    this.testUserCheckbox = page.locator('input#testUser');
    this.smsCheckbox = page.locator('#smsNotifications'); // Added for new tests
    this.redCapInput = page.locator('input#redCapStudyId');
    this.mrnInput = page.locator('input#mrn');
    this.clinicSelect = page.locator('select#clinicId');
    this.languageSelect = page.locator('select#language');
    
    // Common elements
    this.emailInput = page.locator('input#email');
    this.finalAddButton = page.locator('button.btn-primary:has-text("Add")');
    this.errorMessageList = page.locator('ul.list-unstyled');
  }

  // --- Clinicians methods ---

  async goToClinicians() {
    const loader = this.page.locator('text=Loading');
    if (await loader.isVisible()) {
      await loader.waitFor({ state: 'hidden', timeout: 15000 });
    }
    await this.cliniciansSidebarLink.waitFor({ state: 'visible' });
    await this.cliniciansSidebarLink.click();
    await expect(this.page).toHaveURL(/.*admin\/clinicians/);
  }

  async openAddClinicianForm() {
    await this.addClinicianButton.click();
    await expect(this.page).toHaveURL(/.*clinicians\/add/);
  }

  async fillClinicianData(name: string, email: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
  }

  async addClinicToClinician() {
    await this.page.locator('button:has-text("Add Clinic")').click();
    await this.clinicSelectAddDoctor.waitFor({ state: 'visible' });
    await this.clinicSelectAddDoctor.selectOption({ label: 'Regression Clinic' });
    await this.getCallbackCheckbox.check();
    await this.modalAddClinicButton.click();
    await this.modalAddClinicButton.waitFor({ state: 'hidden' });
  }

  async submitClinicianForm() {
    await this.finalAddButton.click();
    await this.page.waitForTimeout(1500);

    if (await this.errorMessageList.isVisible()) {
      const errorText = await this.errorMessageList.innerText();
      throw new Error(`🛑 Creation failed: ${errorText.trim()}`);
    }
    await this.page.waitForURL('**/admin/clinicians', { timeout: 15000 });
  }

  async findClinicianByEmail(email: string) {
    let currentPage = 1;
    while (true) {
      const emailCell = this.page.locator(`td.table-column-wrap:has-text("${email}")`);
      if (await emailCell.isVisible()) return true;

      currentPage++;
      const nextBtn = this.page.locator(`.page-item button:text("${currentPage}")`);
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await this.page.waitForLoadState('networkidle');
      } else {
        break;
      }
    }
    return false;
  }

  async deleteClinicianByEmail(email: string) {
    const row = this.page.locator('tr').filter({ has: this.page.locator('td', { hasText: email }) });
    await row.getByRole('button', { name: 'Remove clinician' }).click();
    this.page.once('dialog', dialog => dialog.accept());
    const confirmBtn = this.page.locator('.modal-footer button.btn-danger, .modal-footer button:has-text("Delete")');
    if (await confirmBtn.isVisible({ timeout: 2000 })) await confirmBtn.click();
    await expect(row).not.toBeVisible({ timeout: 10000 });
  }

  // --- Patient methods ---

  async goToPatients() {
    const loader = this.page.locator('text=Loading');
    if (await loader.isVisible()) {
      await loader.waitFor({ state: 'hidden', timeout: 15000 });
    }
    await this.patientsSidebarLink.waitFor({ state: 'visible' });
    await this.patientsSidebarLink.click();
    await expect(this.page).toHaveURL(/.*admin\/patient/);
  }

  async openAddPatientForm() {
    await this.addPatientButton.click();
    await expect(this.page).toHaveURL(/.*patient\/add/);
  }

  /**
   * fillPatientData updated: optional parameter uncheckSms added.
   */
  async fillPatientData(data: { 
    first: string, last: string, email: string, sex: string, 
    phone: string, redcap: string, mrn: string, clinic: string, lang: string,
    uncheckSms?: boolean 
  }) {
    await this.firstNameInput.fill(data.first);
    await this.lastNameInput.fill(data.last);
    await this.emailInput.fill(data.email);
    await this.sexSelect.selectOption({ label: data.sex });
    await this.phoneInput.fill(data.phone);
    
    // New logic: if uncheckSms is requested
    if (data.uncheckSms) {
      await this.smsCheckbox.uncheck();
    } else {
      await this.testUserCheckbox.check();
    }

    await this.redCapInput.fill(data.redcap);
    await this.mrnInput.fill(data.mrn);
    await this.clinicSelect.selectOption({ label: data.clinic });
    await this.languageSelect.selectOption({ label: data.lang });
  }

  async submitForm(redirectUrlPattern: string | RegExp) {
    await this.finalAddButton.click();
    await this.page.waitForTimeout(1500);

    if (await this.errorMessageList.isVisible()) {
      const errorText = await this.errorMessageList.innerText();
      throw new Error(`🛑 Creation failed: ${errorText.trim()}`);
    }
    await this.page.waitForURL(redirectUrlPattern, { timeout: 15000 });
  }

  async findPatientByName(firstName: string, lastName: string) {
    let currentPage = 1;
    while (true) {
      const patientRow = this.page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName });
      if (await patientRow.count() > 0 && await patientRow.first().isVisible()) return true;

      currentPage++;
      const nextBtn = this.page.locator(`.page-item button:text("${currentPage}")`);
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000); 
      } else {
        break;
      }
    }
    return false;
  }

  async deletePatientByName(firstName: string, lastName: string) {
    const row = this.page.locator('tr').filter({ hasText: firstName }).filter({ hasText: lastName }).first();
    await row.getByRole('button', { name: 'Remove patient' }).click();
    
    this.page.once('dialog', dialog => dialog.accept());
    const confirmBtn = this.page.locator('.modal-footer button.btn-danger, .modal-footer button:has-text("Delete")');
    if (await confirmBtn.isVisible({ timeout: 2000 })) await confirmBtn.click();
    
    await expect(row).not.toBeVisible({ timeout: 10000 });
  }
}