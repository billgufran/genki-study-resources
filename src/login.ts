import { authController } from './auth.js';

void setupLoginPage();

async function setupLoginPage(): Promise<void> {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void init());
  } else {
    await init();
  }
}

async function init(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('#magic-link-form');
  const emailInput = document.querySelector<HTMLInputElement>('#magic-link-email');
  const status = document.querySelector<HTMLElement>('#magic-link-status');
  const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');

  try {
    await authController.init();
  } catch (error) {
    updateStatus(status, 'Unable to initialise authentication. Check your configuration.', true);
    console.error(error);
  }

  authController.onChange((state) => {
    if (state.status === 'authenticated') {
      window.location.replace('/');
    }
  });

  if (!form || !emailInput || !status || !submitButton) {
    console.error('Login form markup missing required elements.');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();

    if (!email) {
      updateStatus(status, 'Please enter your email address.', true);
      return;
    }

    submitButton.disabled = true;
    updateStatus(status, 'Sending magic link…', false);

    try {
      await authController.signInWithOtp(email);
      updateStatus(
        status,
        'Check your inbox for the magic link. You can close this tab after using the link.',
        false
      );
    } catch (error) {
      console.error(error);
      updateStatus(
        status,
        error instanceof Error ? error.message : 'Unable to send magic link. Try again later.',
        true
      );
    } finally {
      submitButton.disabled = false;
    }
  });
}

function updateStatus(target: HTMLElement | null, message: string, isError: boolean): void {
  if (!target) {
    return;
  }
  target.textContent = message;
  target.setAttribute('data-error', isError ? 'true' : 'false');
}
