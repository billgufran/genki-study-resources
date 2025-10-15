import { authController } from './auth.js';
import type { AuthState } from './auth.js';
import { syncController } from './sync.js';

const LOGIN_PATH = '/login.html';

let syncReady = false;
let userStatus: {
  container: HTMLDivElement;
  label: HTMLSpanElement;
  button: HTMLButtonElement;
} | null = null;

void start();

function start(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

async function bootstrap(): Promise<void> {
  const isLoginPage = isLoginRoute();

  ensureGate();
  updateGate('loading', 'Authenticating…');

  try {
    await authController.init();
  } catch (error) {
    console.error(error);
    updateGate(
      'error',
      'Authentication setup failed. Please double-check your Supabase configuration.'
    );
    return;
  }

  authController.onChange((state) => {
    renderUserStatus(state);
    if (state.status === 'authenticated' && state.user) {
      updateGate('success', '');

      if (isLoginPage) {
        window.location.replace('/');
        return;
      }

      if (!syncReady) {
        syncController.init(authController.client, state.user);
        syncReady = true;
      }

      hideGate();
      registerServiceWorker();
    } else if (state.status === 'unauthenticated') {
      syncController.destroy();
      syncReady = false;
      renderUserStatus(state);
      if (!isLoginPage) {
        updateGate('locked', 'You need to log in to continue.');
        window.location.replace(LOGIN_PATH);
      } else {
        hideGate();
      }
    } else {
      updateGate('loading', 'Authenticating…');
      renderUserStatus(state);
    }
  });
}

function isLoginRoute(): boolean {
  return window.location.pathname.endsWith('/login.html');
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return;
  }

  void navigator.serviceWorker
    .register('/resources/javascript/sw.js')
    .catch((error) => console.warn('Service worker registration failed', error));
}

function ensureGate(): void {
  if (document.getElementById('genki-auth-gate')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'genki-auth-gate-style';
  style.textContent = `
    #genki-auth-gate {
      position: fixed;
      z-index: 9999;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(5, 5, 5, 0.85);
      color: #fff;
      text-align: center;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #genki-auth-gate[hidden] {
      display: none !important;
    }
    #genki-auth-gate h2 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
    }
    #genki-auth-gate p {
      margin: 0;
      font-size: 1rem;
      max-width: 32rem;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'genki-auth-gate';
  container.innerHTML = `
    <h2>Loading…</h2>
    <p>Please wait while we verify your session.</p>
  `;

  document.body.appendChild(container);
}

function updateGate(status: 'loading' | 'locked' | 'success' | 'error', message: string): void {
  const gate = document.getElementById('genki-auth-gate');
  if (!gate) {
    return;
  }
  const title = gate.querySelector('h2');
  const content = gate.querySelector('p');

  if (status === 'success') {
    gate.setAttribute('hidden', 'hidden');
    return;
  }

  gate.removeAttribute('hidden');

  switch (status) {
    case 'loading':
      if (title) title.textContent = 'Loading…';
      if (content) content.textContent = message || 'Authenticating your session.';
      break;
    case 'locked':
      if (title) title.textContent = 'Login Required';
      if (content) content.textContent = message || 'Redirecting to login.';
      break;
    case 'error':
      if (title) title.textContent = 'Setup Required';
      if (content)
        content.textContent =
          message ||
          'Missing configuration. Please create resources/javascript/config.js with your Supabase credentials.';
      break;
    default:
      break;
  }
}

function hideGate(): void {
  const gate = document.getElementById('genki-auth-gate');
  if (gate) {
    gate.setAttribute('hidden', 'hidden');
  }
}

function renderUserStatus(state: AuthState): void {
  if (!userStatus) {
    userStatus = createUserStatus();
  }

  const { container, label, button } = userStatus;

  if (state.status !== 'authenticated' || !state.user) {
    container.setAttribute('hidden', 'hidden');
    button.disabled = false;
    return;
  }

  const email = state.user.email || 'Signed in';
  label.textContent = `Signed in as ${email}`;
  button.disabled = false;
  container.removeAttribute('hidden');
}

function createUserStatus(): {
  container: HTMLDivElement;
  label: HTMLSpanElement;
  button: HTMLButtonElement;
} {
  const container =
    (document.getElementById('genki-user-status') as HTMLDivElement | null) ??
    document.createElement('div');

  container.id = 'genki-user-status';
  container.setAttribute('hidden', 'hidden');
  container.style.position = 'fixed';
  container.style.bottom = '1rem';
  container.style.right = '1rem';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '0.75rem';
  container.style.padding = '0.5rem 0.75rem';
  container.style.backgroundColor = 'rgba(17, 17, 17, 0.85)';
  container.style.color = '#fff';
  container.style.borderRadius = '999px';
  container.style.boxShadow = '0 0.5rem 1.5rem rgba(0, 0, 0, 0.25)';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  container.style.fontSize = '0.9rem';
  container.style.zIndex = '9000';

  const label =
    (container.querySelector('span') as HTMLSpanElement | null) ?? document.createElement('span');
  label.textContent = 'Signed in';

  const button =
    (container.querySelector('button') as HTMLButtonElement | null) ??
    document.createElement('button');
  button.type = 'button';
  button.textContent = 'Sign out';
  button.style.background = '#f15a24';
  button.style.color = '#fff';
  button.style.border = 'none';
  button.style.borderRadius = '999px';
  button.style.padding = '0.35rem 0.9rem';
  button.style.cursor = 'pointer';
  button.style.fontSize = '0.85rem';
  button.style.fontWeight = '600';
  button.style.transition = 'background 0.2s ease';

  if (!button.dataset.bound) {
    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await authController.signOut();
      } catch (error) {
        console.error('Failed to sign out', error);
        button.disabled = false;
      }
    });
  }

  button.addEventListener('mouseenter', () => {
    button.style.background = '#d84d1f';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = '#f15a24';
  });

  if (!label.parentElement) {
    container.appendChild(label);
  }
  if (!button.parentElement) {
    container.appendChild(button);
  }

  if (!container.parentElement) {
    document.body.appendChild(container);
  }

  return { container, label, button };
}
