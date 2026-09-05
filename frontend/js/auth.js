// CompressX Authentication Logic

document.addEventListener('DOMContentLoaded', () => {
    // 1. REGISTER FORM HANDLER
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm').value;

            const errBox = document.getElementById('register-error');
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (errBox) errBox.textContent = '';

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                if (errBox) errBox.textContent = 'Please enter a valid email address.';
                showToast('Please enter a valid email address.', 'error');
                return;
            }

            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await apiFetch('/api/auth/register', {
                    method: 'POST',
                    body: { name, email, password, confirmPassword }
                });

                showToast('Account created successfully! Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1200);
            } catch (err) {
                if (errBox) errBox.textContent = err.message;
                showToast(err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // 2. LOGIN FORM HANDLER
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // Check query params for notices
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('expired')) {
            showToast('Your session has expired. Please sign in again.', 'info');
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('login-remember')?.checked;

            const errBox = document.getElementById('login-error');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (errBox) errBox.textContent = '';
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await apiFetch('/api/auth/login', {
                    method: 'POST',
                    body: { email, password, rememberMe }
                });

                showToast('Signed in successfully!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 800);
            } catch (err) {
                if (errBox) errBox.textContent = err.message;
                showToast(err.message, 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // 3. FORGOT PASSWORD MODAL / FORM
    const forgotBtn = document.getElementById('forgot-btn');
    if (forgotBtn) {
        forgotBtn.onclick = async () => {
            const email = prompt("Enter your account email to receive a password reset link:");
            if (!email) return;

            try {
                const res = await apiFetch('/api/auth/forgot-password', {
                    method: 'POST',
                    body: { email }
                });

                showToast(res.message, 'info');

                // Display dev mode link if available
                if (res.devResetLink) {
                    const banner = document.getElementById('dev-link-banner');
                    if (banner) {
                        banner.classList.remove('hidden');
                        banner.innerHTML = `<strong>DEV RESET LINK:</strong> <a href="${res.devResetLink}" target="_blank" style="word-break: break-all; color: #4F46E5;">${res.devResetLink}</a>`;
                    }
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
    }
});

async function handleLogout() {
    try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
        showToast('Signed out successfully', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
    } catch (e) {
        window.location.href = 'login.html';
    }
}
