import { authController } from './auth.js';
void setupLoginPage();
async function setupLoginPage() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => void init());
    }
    else {
        await init();
    }
}
async function init() {
    const form = document.querySelector('#otp-form');
    const emailInput = document.querySelector('#otp-email');
    const tokenInput = document.querySelector('#otp-token');
    const status = document.querySelector('#otp-status');
    const submitButton = document.querySelector('#otp-submit');
    const otpStep = document.querySelector('#otp-step');
    const resendButton = document.querySelector('#otp-resend');
    if (!form || !emailInput || !tokenInput || !status || !submitButton || !otpStep || !resendButton) {
        console.error('Login form markup missing required elements.');
        return;
    }
    const emailField = emailInput;
    const tokenField = tokenInput;
    const statusEl = status;
    const submitEl = submitButton;
    const otpContainer = otpStep;
    const resendEl = resendButton;
    let otpRequested = false;
    let currentEmail = '';
    resendEl.style.display = 'none';
    try {
        await authController.init();
    }
    catch (error) {
        updateStatus(statusEl, 'Unable to initialise authentication. Check your configuration.', true);
        console.error(error);
    }
    authController.onChange((state) => {
        if (state.status === 'authenticated') {
            updateStatus(statusEl, 'Signed in. Redirecting…', false);
            window.setTimeout(() => {
                window.location.replace('/');
            }, 500);
        }
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!otpRequested) {
            await requestCode();
        }
        else {
            await verifyCode();
        }
    });
    resendEl.addEventListener('click', async () => {
        await requestCode(true);
    });
    emailField.addEventListener('input', () => {
        const normalized = emailField.value.trim().toLowerCase();
        if (otpRequested && normalized !== currentEmail) {
            otpRequested = false;
            currentEmail = '';
            otpContainer.hidden = true;
            resendEl.style.display = 'none';
            submitEl.textContent = 'Email sign-in code';
            tokenField.value = '';
            updateStatus(statusEl, 'Enter your email address to receive a code.', false);
        }
    });
    async function requestCode(isResend = false) {
        const email = emailField.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            updateStatus(statusEl, 'Enter a valid email address.', true);
            emailField.focus();
            return;
        }
        setPending(true);
        updateStatus(statusEl, isResend ? 'Resending sign-in code…' : 'Emailing sign-in code…', false);
        try {
            await authController.requestEmailOtp(email);
            currentEmail = email;
            otpRequested = true;
            otpContainer.hidden = false;
            resendEl.style.display = '';
            submitEl.textContent = 'Verify & sign in';
            updateStatus(statusEl, `Enter the 6-digit code sent to ${email}.`, false);
            window.setTimeout(() => tokenField.focus(), 0);
        }
        catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Unable to send the code. Please try again later.';
            updateStatus(statusEl, message, true);
        }
        finally {
            setPending(false);
        }
    }
    async function verifyCode() {
        const token = tokenField.value.trim();
        if (!currentEmail) {
            updateStatus(statusEl, 'Request a code before verifying.', true);
            return;
        }
        if (!token || token.length < 4) {
            updateStatus(statusEl, 'Enter the 6-digit code from your email.', true);
            tokenField.focus();
            return;
        }
        setPending(true);
        updateStatus(statusEl, 'Verifying code…', false);
        try {
            await authController.verifyEmailOtp(currentEmail, token);
            updateStatus(statusEl, 'Code verified. Finishing sign-in…', false);
        }
        catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Unable to verify the code. Request a new one.';
            updateStatus(statusEl, message, true);
        }
        finally {
            setPending(false);
        }
    }
    function setPending(isPending) {
        submitEl.disabled = isPending;
        resendEl.disabled = isPending;
        emailField.disabled = isPending && !otpRequested;
        tokenField.disabled = isPending && otpRequested;
    }
}
function updateStatus(target, message, isError) {
    if (!target) {
        return;
    }
    target.textContent = message;
    target.setAttribute('data-error', isError ? 'true' : 'false');
}
