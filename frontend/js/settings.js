/**
 * Docholder Settings Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    loadCurrentSettingsIntoUI();
    setupEventListeners();
});

function loadCurrentSettingsIntoUI() {
    const settings = getDocholderSettings();

    // Theme
    updateThemeButtons(settings.theme || 'dark');

    // Reduced Motion
    const redMotion = document.getElementById('setting-reduced-motion');
    if (redMotion) redMotion.checked = settings.reducedMotion === true;

    // High Contrast
    const highContrast = document.getElementById('setting-high-contrast');
    if (highContrast) highContrast.checked = settings.highContrast === true;

    // Sci-Fi SFX
    const scifiSfx = document.getElementById('setting-scifi-sfx');
    if (scifiSfx) scifiSfx.checked = localStorage.getItem('docholder_sfx_enabled') !== 'false';

    // Auto-Download
    const autoDownload = document.getElementById('setting-auto-download');
    if (autoDownload) autoDownload.checked = settings.autoDownload === true;

    // Image Quality
    const imgQuality = document.getElementById('setting-default-img-quality');
    const imgQualityVal = document.getElementById('setting-img-quality-val');
    if (imgQuality) {
        imgQuality.value = settings.defaultImageQuality || 85;
        if (imgQualityVal) imgQualityVal.textContent = `${imgQuality.value}%`;
    }

    // Video Quality
    const vidQuality = document.getElementById('setting-default-vid-quality');
    if (vidQuality) vidQuality.value = settings.defaultVideoQuality || 'medium';

    // Compression Profile
    const compression = document.getElementById('setting-default-compression');
    if (compression) compression.value = settings.defaultCompression || 'optimal';

    // In-App Notifications
    const notifs = document.getElementById('setting-notifications-enabled');
    if (notifs) notifs.checked = settings.notificationsEnabled !== false;

    // Notification Duration
    const duration = document.getElementById('setting-notification-duration');
    if (duration) duration.value = String(settings.notificationDuration || 4000);
}

function updateThemeButtons(theme) {
    const btnDark = document.getElementById('btn-theme-dark');
    const btnLight = document.getElementById('btn-theme-light');
    const btnSystem = document.getElementById('btn-theme-system');
    if (btnDark) {
        btnDark.classList.toggle('btn-primary', theme === 'dark');
        btnDark.classList.toggle('btn-secondary', theme !== 'dark');
    }
    if (btnLight) {
        btnLight.classList.toggle('btn-primary', theme === 'light');
        btnLight.classList.toggle('btn-secondary', theme !== 'light');
    }
    if (btnSystem) {
        btnSystem.classList.toggle('btn-primary', theme === 'system');
        btnSystem.classList.toggle('btn-secondary', theme !== 'system');
    }
}

function setupEventListeners() {
    // Theme switches
    const btnDark = document.getElementById('btn-theme-dark');
    const btnLight = document.getElementById('btn-theme-light');
    const btnSystem = document.getElementById('btn-theme-system');

    if (btnDark) {
        btnDark.addEventListener('click', () => {
            setAppTheme('dark', false);
            updateThemeButtons('dark');
            showToast('Dark theme activated.', 'info', 2000);
        });
    }

    if (btnLight) {
        btnLight.addEventListener('click', () => {
            setAppTheme('light', false);
            updateThemeButtons('light');
            showToast('Light theme activated.', 'info', 2000);
        });
    }

    if (btnSystem) {
        btnSystem.addEventListener('click', () => {
            setAppTheme('system', false);
            updateThemeButtons('system');
            showToast('System Default theme activated.', 'info', 2000);
        });
    }

    // Image quality slider
    const imgQuality = document.getElementById('setting-default-img-quality');
    const imgQualityVal = document.getElementById('setting-img-quality-val');
    if (imgQuality && imgQualityVal) {
        imgQuality.addEventListener('input', (e) => {
            imgQualityVal.textContent = `${e.target.value}%`;
        });
    }

    // Reduced motion checkbox immediate effect
    const redMotion = document.getElementById('setting-reduced-motion');
    if (redMotion) {
        redMotion.addEventListener('change', (e) => {
            document.documentElement.classList.toggle('reduce-motion', e.target.checked);
            saveDocholderSettings({ reducedMotion: e.target.checked });
        });
    }

    // Sci-Fi SFX checkbox immediate effect
    const scifiSfx = document.getElementById('setting-scifi-sfx');
    if (scifiSfx) {
        scifiSfx.addEventListener('change', (e) => {
            if (window.DocholderAudio) {
                window.DocholderAudio.enabled = e.target.checked;
                localStorage.setItem('docholder_sfx_enabled', e.target.checked ? 'true' : 'false');
                window.DocholderAudio.updateHeaderToggleIcons();
                if (e.target.checked) window.DocholderAudio.playSuccess();
            }
        });
    }

    // High contrast checkbox immediate effect
    const highContrast = document.getElementById('setting-high-contrast');
    if (highContrast) {
        highContrast.addEventListener('change', (e) => {
            document.documentElement.classList.toggle('high-contrast', e.target.checked);
        });
    }

    // Clear History Button
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', async () => {
            showOperationLoader({
                title: 'Clearing Transformation History',
                subtitle: 'Wiping transformation and compression log records...',
                stages: ['Locating history records...', 'Purging database rows...', 'Updating workspace...']
            });

            try {
                await apiFetch('/api/convert/history', { method: 'DELETE' });
                hideOperationLoader();
                showToast('Transformation history cleared successfully!', 'success');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Failed to clear history.', 'error');
            }
        });
    }

    // Permissions Management
    ['storage', 'camera', 'microphone'].forEach(type => {
        const btn = document.getElementById(`btn-perm-${type}`);
        if (!btn) return;
        const key = `docholder_perm_${type}`;
        const isGranted = localStorage.getItem(key) !== 'denied';
        updatePermButton(btn, isGranted);
        btn.onclick = () => {
            const current = localStorage.getItem(key) !== 'denied';
            const next = !current;
            localStorage.setItem(key, next ? 'granted' : 'denied');
            updatePermButton(btn, next);
            showToast(`${type.toUpperCase()} permission ${next ? 'granted' : 'revoked'}.`, next ? 'success' : 'info');
        };
    });

    // Reset workspace session cache
    const btnClearCache = document.getElementById('btn-clear-workspace-cache');
    if (btnClearCache) {
        btnClearCache.onclick = () => {
            localStorage.removeItem('docholder_recent_files');
            localStorage.removeItem('docholder_favorites');
            sessionStorage.clear();
            showToast('Workspace session cache and recent items purged.', 'success');
        };
    }

    // Save All Settings Button
    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme') || 'dark';
            const reducedMotion = document.getElementById('setting-reduced-motion')?.checked === true;
            const highContrast = document.getElementById('setting-high-contrast')?.checked === true;
            const autoDownload = document.getElementById('setting-auto-download')?.checked === true;
            const defaultImageQuality = parseInt(document.getElementById('setting-default-img-quality')?.value || '85', 10);
            const defaultVideoQuality = document.getElementById('setting-default-vid-quality')?.value || 'medium';
            const defaultCompression = document.getElementById('setting-default-compression')?.value || 'optimal';
            const notificationsEnabled = document.getElementById('setting-notifications-enabled')?.checked !== false;
            const notificationDuration = parseInt(document.getElementById('setting-notification-duration')?.value || '4000', 10);

            const updatedSettings = {
                theme,
                reducedMotion,
                highContrast,
                autoDownload,
                defaultImageQuality,
                defaultVideoQuality,
                defaultCompression,
                notificationsEnabled,
                notificationDuration
            };

            saveDocholderSettings(updatedSettings);
            showToast('All settings saved and applied successfully!', 'success');
        });
    }
}
