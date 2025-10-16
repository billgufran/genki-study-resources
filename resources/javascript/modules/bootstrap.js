import './settings.js';
import { authController } from './auth.js';
import { syncController } from './sync.js';
let syncReady = false;
let userStatus = null;
void start();
function start() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    }
    else {
        void bootstrap();
    }
}
async function bootstrap() {
    authController.onChange(handleAuthState);
    try {
        await authController.init();
    }
    catch (error) {
        console.error('Authentication setup failed. Please double-check your Supabase configuration.', error);
    }
    registerServiceWorker();
}
function handleAuthState(state) {
    renderUserStatus(state);
    if (state.status === 'authenticated' && state.user) {
        if (!syncReady) {
            syncController.init(authController.client, state.user);
            syncReady = true;
        }
    }
    else if (syncReady) {
        syncController.destroy();
        syncReady = false;
    }
    window.dispatchEvent(new CustomEvent('genki-auth-state', { detail: state }));
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
function renderUserStatus(state) {
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
function createUserStatus() {
    const container = document.getElementById('genki-user-status') ??
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
    const label = container.querySelector('span') ?? document.createElement('span');
    label.textContent = 'Signed in';
    const button = container.querySelector('button') ??
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
            }
            catch (error) {
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
