import { authController } from './auth.js';
import { syncController } from './sync.js';
const LOGIN_PATH = '/login.html';
let syncReady = false;
void start();
function start() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    }
    else {
        bootstrap();
    }
}
async function bootstrap() {
    const isLoginPage = isLoginRoute();
    ensureGate();
    updateGate('loading', 'Authenticating…');
    try {
        await authController.init();
    }
    catch (error) {
        console.error(error);
        updateGate('error', 'Authentication setup failed. Please double-check your Supabase configuration.');
        return;
    }
    authController.onChange((state) => {
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
        }
        else if (state.status === 'unauthenticated') {
            syncController.destroy();
            syncReady = false;
            if (!isLoginPage) {
                updateGate('locked', 'You need to log in to continue.');
                window.location.replace(LOGIN_PATH);
            }
            else {
                hideGate();
            }
        }
        else {
            updateGate('loading', 'Authenticating…');
        }
    });
}
function isLoginRoute() {
    return window.location.pathname.endsWith('/login.html');
}
function registerServiceWorker() {
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
function ensureGate() {
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
function updateGate(status, message) {
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
            if (title)
                title.textContent = 'Loading…';
            if (content)
                content.textContent = message || 'Authenticating your session.';
            break;
        case 'locked':
            if (title)
                title.textContent = 'Login Required';
            if (content)
                content.textContent = message || 'Redirecting to login.';
            break;
        case 'error':
            if (title)
                title.textContent = 'Setup Required';
            if (content)
                content.textContent =
                    message ||
                        'Missing configuration. Please create resources/javascript/config.js with your Supabase credentials.';
            break;
        default:
            break;
    }
}
function hideGate() {
    const gate = document.getElementById('genki-auth-gate');
    if (gate) {
        gate.setAttribute('hidden', 'hidden');
    }
}
