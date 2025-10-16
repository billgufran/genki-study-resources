import { authController } from './auth.js';
import type { AuthState } from './auth.js';
import { syncController, type SyncMeta } from './sync.js';

declare global {
  interface Window {
    GenkiSettings?: {
      manager?: (...args: unknown[]) => unknown;
    };
  }
}

type WrappedManager = ((...args: unknown[]) => unknown) & { __genkiSyncWrapped?: boolean };

class SettingsSyncPanel {
  private container: HTMLDivElement | null = null;
  private statusEl: HTMLParagraphElement | null = null;
  private formSection: HTMLDivElement | null = null;
  private authedSection: HTMLDivElement | null = null;
  private form: HTMLFormElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private otpInput: HTMLInputElement | null = null;
  private otpWrapper: HTMLElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private resendButton: HTMLButtonElement | null = null;
  private syncButton: HTMLButtonElement | null = null;
  private signOutButton: HTMLButtonElement | null = null;
  private lastSyncEl: HTMLParagraphElement | null = null;
  private accountEl: HTMLParagraphElement | null = null;

  private otpRequested = false;
  private currentEmail: string | null = null;
  private authState: AuthState | null = null;
  private syncMeta: SyncMeta | null = null;

  constructor() {
    this.waitForSettings();
    this.authState = safeGetAuthState();
    this.syncMeta = loadSyncMetaFromStorage();

    window.addEventListener('genki-auth-state', this.handleAuthStateChange as EventListener);
    window.addEventListener('genki-sync-meta', this.handleSyncMetaChange as EventListener);
  }

  private waitForSettings(attempt = 0): void {
    const settings = window.GenkiSettings;

    if (settings && typeof settings.manager === 'function') {
      this.wrapManager(settings);
      return;
    }

    if (attempt > 20) {
      console.warn('Unable to attach sync controls to the Settings Manager (GenkiSettings.manager not found).');
      return;
    }

    window.setTimeout(() => this.waitForSettings(attempt + 1), 100);
  }

  private wrapManager(settings: NonNullable<typeof window.GenkiSettings>): void {
    const original = settings.manager as WrappedManager;
    if (!original || original.__genkiSyncWrapped) {
      return;
    }

    const wrapped: WrappedManager = ((...args: unknown[]) => {
      const result = original.apply(settings, args);
      window.setTimeout(() => this.mount(), 0);
      return result;
    }) as WrappedManager;

    wrapped.__genkiSyncWrapped = true;
    settings.manager = wrapped;
  }

  private mount(): void {
    const content = document.getElementById('genki-modal-content');
    if (!content) {
      window.setTimeout(() => this.mount(), 50);
      return;
    }

    if (!this.container || !this.container.isConnected) {
      this.buildUi(content);
    }

    this.updateForAuthState();
  }

  private buildUi(content: HTMLElement): void {
    const container = document.createElement('div');
    container.id = 'genki-sync-settings';
    container.style.margin = '1rem 0';
    container.style.paddingBottom = '1.5rem';
    container.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '0.75rem';

    const title = document.createElement('div');
    title.className = 'section-title';
    title.innerHTML = '<span class="en">Sync</span><span class="ja">同期</span>';

    const status = document.createElement('p');
    status.className = 'genki-sync-status';
    status.style.margin = '0';
    status.style.fontSize = '0.95rem';
    status.style.color = '#f9f9f9';
    status.textContent = 'Sign in to sync your progress and preferences.';

    const formSection = this.buildFormSection();
    const authedSection = this.buildAuthedSection();

    container.appendChild(title);
    container.appendChild(status);
    container.appendChild(formSection);
    container.appendChild(authedSection);

    const firstParagraph = content.querySelector('p');
    if (firstParagraph && firstParagraph.parentElement) {
      firstParagraph.parentElement.insertBefore(container, firstParagraph.nextSibling);
    } else {
      content.insertBefore(container, content.firstChild);
    }

    this.container = container;
    this.statusEl = status;
    this.formSection = formSection;
    this.authedSection = authedSection;
  }

  private buildFormSection(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.75rem';

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '0.75rem';

    const fieldRow = document.createElement('div');
    fieldRow.style.display = 'flex';
    fieldRow.style.flexWrap = 'wrap';
    fieldRow.style.gap = '0.75rem';

    const emailGroup = document.createElement('label');
    emailGroup.style.display = 'flex';
    emailGroup.style.flexDirection = 'column';
    emailGroup.style.flex = '1 1 220px';
    emailGroup.style.gap = '0.25rem';
    emailGroup.innerHTML = '<span class="en">Email</span>';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.autocomplete = 'email';
    emailInput.placeholder = 'you@example.com';
    emailInput.required = true;
    applyInputStyles(emailInput);
    emailGroup.appendChild(emailInput);

    const otpGroup = document.createElement('label');
    otpGroup.style.display = 'flex';
    otpGroup.style.flexDirection = 'column';
    otpGroup.style.flex = '1 1 160px';
    otpGroup.style.gap = '0.25rem';
    otpGroup.hidden = true;
    otpGroup.innerHTML = '<span class="en">One-time code</span>';

    const otpInput = document.createElement('input');
    otpInput.type = 'text';
    otpInput.inputMode = 'numeric';
    otpInput.autocomplete = 'one-time-code';
    otpInput.maxLength = 6;
    otpInput.pattern = '\\d{6}';
    otpInput.placeholder = '123456';
    applyInputStyles(otpInput);
    otpGroup.appendChild(otpInput);

    fieldRow.appendChild(emailGroup);
    fieldRow.appendChild(otpGroup);

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.flexWrap = 'wrap';
    buttonRow.style.gap = '0.5rem';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'button';
    submitButton.textContent = 'Email sign-in code';

    const resendButton = document.createElement('button');
    resendButton.type = 'button';
    resendButton.className = 'button opt-off';
    resendButton.textContent = 'Resend code';
    resendButton.hidden = true;

    buttonRow.appendChild(submitButton);
    buttonRow.appendChild(resendButton);

    form.appendChild(fieldRow);
    form.appendChild(buttonRow);

    wrapper.appendChild(form);

    form.addEventListener('submit', this.handleFormSubmit);
    resendButton.addEventListener('click', () => void this.requestCode(true));
    emailInput.addEventListener('input', () => this.handleEmailInputChange());

    this.form = form;
    this.emailInput = emailInput;
    this.otpInput = otpInput;
    this.otpWrapper = otpGroup;
    this.submitButton = submitButton;
    this.resendButton = resendButton;

    return wrapper;
  }

  private buildAuthedSection(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'none';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.75rem';

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '0.35rem';

    const lastSync = document.createElement('p');
    lastSync.style.margin = '0';
    lastSync.style.fontSize = '0.95rem';
    lastSync.style.color = '#f9f9f9';
    lastSync.textContent = 'Last synced: Not yet';

    const account = document.createElement('p');
    account.style.margin = '0';
    account.style.fontSize = '0.95rem';
    account.style.color = '#f9f9f9';
    account.textContent = '';

    info.appendChild(lastSync);
    info.appendChild(account);

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.flexWrap = 'wrap';
    buttonRow.style.gap = '0.5rem';

    const syncButton = document.createElement('button');
    syncButton.type = 'button';
    syncButton.className = 'button';
    syncButton.textContent = 'Sync now';

    const signOutButton = document.createElement('button');
    signOutButton.type = 'button';
    signOutButton.className = 'button opt-off';
    signOutButton.textContent = 'Sign out';

    syncButton.addEventListener('click', () => this.handleManualSync());
    signOutButton.addEventListener('click', () => void this.handleSignOut());

    buttonRow.appendChild(syncButton);
    buttonRow.appendChild(signOutButton);

    wrapper.appendChild(info);
    wrapper.appendChild(buttonRow);

    this.lastSyncEl = lastSync;
    this.accountEl = account;
    this.syncButton = syncButton;
    this.signOutButton = signOutButton;

    return wrapper;
  }

  private handleAuthStateChange = (event: CustomEvent<AuthState>): void => {
    this.authState = event.detail;
    this.updateForAuthState();
  };

  private handleSyncMetaChange = (event: CustomEvent<{ meta: SyncMeta }>): void => {
    this.syncMeta = event.detail.meta;
    this.updateSyncDetails();
  };

  private handleFormSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();

    if (!this.otpRequested) {
      await this.requestCode();
    } else {
      await this.verifyCode();
    }
  };

  private handleEmailInputChange(): void {
    if (!this.emailInput) {
      return;
    }
    const normalized = this.emailInput.value.trim().toLowerCase();
    if (this.otpRequested && normalized !== this.currentEmail) {
      this.resetForm();
      this.setStatus('Enter your email address to receive a code.', false);
    }
  }

  private async requestCode(isResend = false): Promise<void> {
    const email = this.emailInput?.value.trim().toLowerCase() ?? '';

    if (!email || !email.includes('@')) {
      this.setStatus('Enter a valid email address.', true);
      this.emailInput?.focus();
      return;
    }

    this.setFormPending(true);
    this.setStatus(isResend ? 'Resending sign-in code…' : 'Emailing sign-in code…', false);

    try {
      await authController.requestEmailOtp(email);
      this.currentEmail = email;
      this.updateOtpUi(true);
      this.setStatus(`Enter the 6-digit code sent to ${email}.`, false);
      window.setTimeout(() => this.otpInput?.focus(), 0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send the code. Please try again later.';
      this.setStatus(message, true);
    } finally {
      this.setFormPending(false);
    }
  }

  private async verifyCode(): Promise<void> {
    if (!this.currentEmail) {
      this.setStatus('Request a code before verifying.', true);
      return;
    }

    const token = this.otpInput?.value.trim() ?? '';
    if (!token || token.length < 4) {
      this.setStatus('Enter the 6-digit code from your email.', true);
      this.otpInput?.focus();
      return;
    }

    this.setFormPending(true);
    this.setStatus('Verifying code…', false);

    try {
      await authController.verifyEmailOtp(this.currentEmail, token);
      this.setStatus('Code verified. Finishing sign-in…', false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to verify the code. Request a new one.';
      this.setStatus(message, true);
    } finally {
      this.setFormPending(false);
    }
  }

  private async handleSignOut(): Promise<void> {
    if (!this.signOutButton) {
      return;
    }

    this.signOutButton.disabled = true;
    this.setStatus('Signing out…', false);

    try {
      await authController.signOut();
      this.setStatus('Signed out. Local data stays on this device until you sign in again.', false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.';
      this.setStatus(message, true);
    } finally {
      this.signOutButton.disabled = false;
    }
  }

  private handleManualSync(): void {
    this.setStatus('Syncing…', false);
    this.setSyncPending(true);

    try {
      syncController.manualSync();
    } catch (error) {
      console.warn('Manual sync failed to start', error);
      this.setStatus('Unable to trigger a sync right now. Try again later.', true);
      this.setSyncPending(false);
      return;
    }

    window.setTimeout(() => this.setSyncPending(false), 1500);
  }

  private setFormPending(isPending: boolean): void {
    if (this.submitButton) {
      this.submitButton.disabled = isPending;
    }
    if (this.resendButton) {
      this.resendButton.disabled = isPending;
      this.resendButton.hidden = !this.otpRequested;
    }
    if (this.emailInput) {
      this.emailInput.disabled = isPending && !this.otpRequested;
    }
    if (this.otpInput) {
      this.otpInput.disabled = isPending && this.otpRequested;
    }
  }

  private setSyncPending(isPending: boolean): void {
    if (this.syncButton) {
      this.syncButton.disabled = isPending;
    }
  }

  private updateOtpUi(showOtp: boolean): void {
    this.otpRequested = showOtp;

    if (this.otpWrapper) {
      this.otpWrapper.hidden = !showOtp;
    }
    if (this.resendButton) {
      this.resendButton.hidden = !showOtp;
      this.resendButton.disabled = !showOtp;
    }
    if (this.submitButton) {
      this.submitButton.textContent = showOtp ? 'Verify & sign in' : 'Email sign-in code';
    }
  }

  private resetForm(): void {
    this.currentEmail = null;
    this.updateOtpUi(false);
    if (this.emailInput) {
      this.emailInput.disabled = false;
    }
    if (this.otpInput) {
      this.otpInput.disabled = false;
      this.otpInput.value = '';
    }
    if (this.resendButton) {
      this.resendButton.disabled = false;
      this.resendButton.hidden = true;
    }
    if (this.submitButton) {
      this.submitButton.disabled = false;
    }
  }

  private updateForAuthState(): void {
    if (!this.container || !this.statusEl || !this.formSection || !this.authedSection) {
      return;
    }

    const state = this.authState;

    if (!state || state.status === 'loading') {
      this.showUnauthenticatedState();
      this.setStatus('Checking your sync status…', false);
      return;
    }

    if (state.status === 'authenticated' && state.user) {
      this.syncMeta = this.syncMeta ?? loadSyncMetaFromStorage();
      this.showAuthenticatedState();
      this.updateSyncDetails();
      this.setStatus('Sync is active. Use Sync now to back up the latest changes.', false);
    } else {
      this.showUnauthenticatedState();
      this.setStatus('Sign in to sync your progress and preferences.', false);
    }
  }

  private showUnauthenticatedState(): void {
    toggleSection(this.formSection, true);
    toggleSection(this.authedSection, false);
    this.resetForm();
  }

  private showAuthenticatedState(): void {
    toggleSection(this.formSection, false);
    toggleSection(this.authedSection, true);
    this.resetForm();
  }

  private updateSyncDetails(): void {
    if (!this.authedSection || this.authedSection.hasAttribute('hidden')) {
      return;
    }

    const email = this.authState?.user?.email ?? '';
    if (this.accountEl) {
      this.accountEl.textContent = email ? `Signed in as ${email}` : '';
    }

    if (this.lastSyncEl) {
      this.lastSyncEl.textContent = formatLastSynced(this.syncMeta);
    }
  }

  private setStatus(message: string, isError: boolean): void {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.textContent = message;
    this.statusEl.style.color = isError ? '#ffb4a2' : '#f9f9f9';
  }
}

function toggleSection(section: HTMLDivElement | null, show: boolean): void {
  if (!section) {
    return;
  }
  section.style.display = show ? 'flex' : 'none';
}

function applyInputStyles(input: HTMLInputElement): void {
  input.style.padding = '0.6rem 0.65rem';
  input.style.borderRadius = '0.45rem';
  input.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  input.style.background = 'rgba(0, 0, 0, 0.55)';
  input.style.color = '#f9f9f9';
  input.style.fontSize = '0.95rem';
  input.style.width = '100%';
}

function safeGetAuthState(): AuthState | null {
  try {
    return authController.currentState;
  } catch {
    return null;
  }
}

function loadSyncMetaFromStorage(): SyncMeta | null {
  try {
    const raw = localStorage.getItem('__genki_sync_meta__');
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SyncMeta;
  } catch {
    return null;
  }
}

function formatLastSynced(meta: SyncMeta | null): string {
  const latest = getLatestTimestamp(meta);
  if (!latest) {
    return 'Last synced: Not yet';
  }

  const date = new Date(latest);
  if (Number.isNaN(date.getTime())) {
    return 'Last synced: Unknown';
  }

  return `Last synced: ${date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })}`;
}

function getLatestTimestamp(meta: SyncMeta | null): string | null {
  if (!meta) {
    return null;
  }
  const candidates = [
    meta.preferenceLastSyncedAt,
    meta.progressLastSyncedAt,
    meta.preferenceRemoteUpdatedAt,
    meta.progressRemoteUpdatedAt
  ].filter((value): value is string => Boolean(value));

  if (!candidates.length) {
    return null;
  }

  candidates.sort();
  return candidates[candidates.length - 1];
}

new SettingsSyncPanel();

export {};
