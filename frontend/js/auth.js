/**
 * CompressX — Authentication UI Logic
 * Handles: Register, Login, Logout, Forgot Password
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Utility: show inline field error ──────────────────────────────────
    function setFieldError(fieldId, msg) {
        const el = document.getElementById(fieldId);
        if (!el) return;
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
    }

    function clearAllErrors(...ids) {
        ids.forEach(id => setFieldError(id, ''));
    }

    // ── Utility: password visibility toggle ───────────────────────────────
    function setupPasswordToggle(inputId, toggleId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(toggleId);
        if (!input || !btn) return;
        btn.addEventListener('click', () => {
            const isText = input.type === 'text';
            input.type = isText ? 'password' : 'text';
            btn.innerHTML = isText
                ? '<i class="fa-solid fa-eye"></i>'
                : '<i class="fa-solid fa-eye-slash"></i>';
        });
    }

    setupPasswordToggle('login-password', 'toggle-login-pw');
    setupPasswordToggle('reg-password', 'toggle-reg-pw');
    setupPasswordToggle('reg-confirm', 'toggle-reg-confirm');

    // ── Real-time confirm password match ──────────────────────────────────
    const regConfirm = document.getElementById('reg-confirm');
    const regPassword = document.getElementById('reg-password');
    if (regConfirm && regPassword) {
        regConfirm.addEventListener('input', () => {
            if (regConfirm.value && regConfirm.value !== regPassword.value) {
                setFieldError('err-confirm', 'Passwords do not match.');
            } else {
                setFieldError('err-confirm', '');
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // 1. REGISTER FORM
    // ══════════════════════════════════════════════════════════════════════
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email       = document.getElementById('reg-email')?.value.trim();
            const username    = document.getElementById('reg-username')?.value.trim();
            const dateOfBirth = document.getElementById('reg-dob')?.value;
            const password    = document.getElementById('reg-password')?.value;
            const confirmPassword = document.getElementById('reg-confirm')?.value;
            const submitBtn   = registerForm.querySelector('button[type="submit"]');

            clearAllErrors('err-email', 'err-username', 'err-dob', 'err-password', 'err-confirm', 'err-register-general');

            // ── Client-side validation ────────────────────────────────────
            let hasError = false;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                setFieldError('err-email', 'Please enter a valid email address.');
                hasError = true;
            }

            const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
            if (!username || !usernameRegex.test(username)) {
                setFieldError('err-username', 'Username must be 3–30 characters: letters, numbers, underscores only.');
                hasError = true;
            }

            if (!dateOfBirth) {
                setFieldError('err-dob', 'Please enter your date of birth.');
                hasError = true;
            } else {
                const dob = new Date(dateOfBirth);
                const now = new Date();
                if (isNaN(dob.getTime()) || dob >= now) {
                    setFieldError('err-dob', 'Date of birth must be a valid past date.');
                    hasError = true;
                } else {
                    const age = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
                    if (age < 8) {
                        setFieldError('err-dob', 'You must be at least 8 years old to register.');
                        hasError = true;
                    }
                }
            }

            if (!password || password.length < 8) {
                setFieldError('err-password', 'Password must be at least 8 characters.');
                hasError = true;
            } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
                setFieldError('err-password', 'Password must contain at least one letter and one number.');
                hasError = true;
            }

            if (!confirmPassword || confirmPassword !== password) {
                setFieldError('err-confirm', 'Passwords do not match.');
                hasError = true;
            }

            if (hasError) return;

            // ── Submit ────────────────────────────────────────────────────
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';
            }

            try {
                await apiFetch('/api/auth/register', {
                    method: 'POST',
                    body: { email, username, dateOfBirth, password, confirmPassword }
                });

                if (typeof showToast === 'function') showToast('Account created! Redirecting to sign in…', 'success');
                setTimeout(() => { window.location.href = 'login.html?registered=1'; }, 1200);
            } catch (err) {
                const msg = err.message || 'Registration failed. Please try again.';
                setFieldError('err-register-general', msg);
                if (typeof showToast === 'function') showToast(msg, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
                }
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // 2. LOGIN FORM
    // ══════════════════════════════════════════════════════════════════════
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const params = new URLSearchParams(window.location.search);

        if (params.get('registered') === '1') {
            const notice = document.getElementById('login-success-notice');
            if (notice) {
                notice.textContent = 'Account created successfully! You can now sign in.';
                notice.style.display = 'block';
            }
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username  = document.getElementById('login-username')?.value.trim();
            const password  = document.getElementById('login-password')?.value;
            const rememberMe = document.getElementById('login-remember')?.checked;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            clearAllErrors('err-login-general');

            if (!username || !password) {
                setFieldError('err-login-general', 'Please enter your username and password.');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing you in…';
            }

            try {
                const res = await apiFetch('/api/auth/login', {
                    method: 'POST',
                    body: { username, password, rememberMe }
                });

                if (res && res.token) {
                    localStorage.setItem('docholder_auth_token', res.token);
                }

                if (typeof showToast === 'function') showToast('Welcome back! 👋', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
            } catch (err) {
                const msg = err.message || 'Invalid username or password.';
                setFieldError('err-login-general', msg);
                if (typeof showToast === 'function') showToast(msg, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
                }
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3. FORGOT PASSWORD
    // ══════════════════════════════════════════════════════════════════════
    const forgotBtn = document.getElementById('forgot-btn');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async () => {
            const email = prompt('Enter your account email to receive a password reset link:');
            if (!email) return;
            try {
                const res = await apiFetch('/api/auth/forgot-password', {
                    method: 'POST',
                    body: { email }
                });
                if (typeof showToast === 'function') showToast(res.message || 'Reset link sent!', 'info');
                if (res.devResetLink) {
                    const banner = document.getElementById('dev-link-banner');
                    if (banner) {
                        banner.classList.remove('hidden');
                        banner.style.display = 'block';
                        banner.innerHTML = `<strong>DEV RESET LINK:</strong> <a href="${res.devResetLink}" style="word-break:break-all;color:var(--primary);">${res.devResetLink}</a>`;
                    }
                }
            } catch (err) {
                if (typeof showToast === 'function') showToast(err.message, 'error');
            }
        });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// GLOBAL: Logout — called from any page
// ══════════════════════════════════════════════════════════════════════════
async function handleLogout() {
    try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    if (typeof showToast === 'function') showToast('Signed out successfully.', 'info');
    setTimeout(() => { window.location.href = 'login.html'; }, 400);
}
