/**
 * authGuard.js — Session-based route protection for CompressX
 *
 * Usage on PROTECTED pages (dashboard, tools, files, etc.):
 *   <script src="js/authGuard.js"></script>
 *   Then the guard runs automatically on DOMContentLoaded.
 *
 * Usage on AUTH pages (welcome, login, register):
 *   <script src="js/authGuard.js" data-mode="unauth"></script>
 *   If already logged in → redirect to dashboard.
 */

(function () {
    const mode = document.currentScript
        ? document.currentScript.getAttribute('data-mode')
        : null;

    const LOGIN_PAGE = 'login.html';
    const DASHBOARD_PAGE = 'dashboard.html';

    // Store resolved user globally so pages can use it
    window.__authUser = null;

    async function verifySession() {
        try {
            const res = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                return data.user || null;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // Show a brief "Checking session…" overlay to prevent flash of content
    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = '__auth-guard-overlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'background:var(--background,#0f0f13)',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'gap:12px'
        ].join(';');
        overlay.innerHTML = `
            <div style="width:36px;height:36px;border:3px solid var(--primary,#7c3aed);border-top-color:transparent;border-radius:50%;animation:__ag-spin 0.7s linear infinite;"></div>
            <style>@keyframes __ag-spin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    function removeOverlay() {
        const el = document.getElementById('__auth-guard-overlay');
        if (el) el.remove();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const overlay = showLoadingOverlay();
        const user = await verifySession();

        if (mode === 'unauth') {
            // Auth pages: if already logged in → send to dashboard
            removeOverlay();
            if (user) {
                window.location.replace(DASHBOARD_PAGE);
            }
        } else {
            // Protected pages: if NOT logged in → send to login
            if (!user) {
                window.location.replace(LOGIN_PAGE + '?expired=1');
            } else {
                window.__authUser = user;
                removeOverlay();
                // Populate any username/greeting elements
                document.querySelectorAll('[data-auth-username]').forEach(el => {
                    el.textContent = user.username || user.email || 'User';
                });
            }
        }
    });
})();
