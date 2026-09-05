// Docholder API Client, Mobile State & Notifications

// Initialize Theme
const savedTheme = localStorage.getItem('docholder_theme') || 'dark';
setAppTheme(savedTheme, false);

// Initialize View Mode (Mobile Frame vs Fullscreen)
const savedViewMode = localStorage.getItem('docholder_view_mode') || 'mobile';
if (savedViewMode === 'fullscreen' && document.body) {
    document.body.classList.add('fullscreen-mode');
}

function toggleViewMode() {
    const isFullscreen = document.body.classList.toggle('fullscreen-mode');
    const newMode = isFullscreen ? 'fullscreen' : 'mobile';
    localStorage.setItem('docholder_view_mode', newMode);
    updateViewModeButtonText();
    showToast(`Switched to ${isFullscreen ? 'Fullscreen' : 'Mobile Phone'} mode`, 'info', 2000);
}

function updateViewModeButtonText() {
    const btn = document.getElementById('view-mode-toggle-btn');
    if (btn) {
        const isFullscreen = document.body.classList.contains('fullscreen-mode');
        btn.innerHTML = isFullscreen 
            ? '<i class="fa-solid fa-mobile-screen"></i> <span>Mobile View</span>'
            : '<i class="fa-solid fa-expand"></i> <span>Fullscreen</span>';
    }
}

function setAppTheme(theme, showNotice = false) {
    const validTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', validTheme);
    if (document.body) document.body.setAttribute('data-theme', validTheme);
    localStorage.setItem('docholder_theme', validTheme);
    
    try {
        const settings = getDocholderSettings();
        settings.theme = validTheme;
        localStorage.setItem('docholder_settings', JSON.stringify(settings));
    } catch(e) {}

    updateThemeIcons(validTheme);
    if (showNotice) {
        showToast(`Theme changed to ${validTheme.toUpperCase()}`, 'info', 2000);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setAppTheme(next, true);
}

function updateThemeIcons(theme) {
    let effectiveTheme = theme;
    if (theme === 'system') {
        effectiveTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.querySelectorAll('.theme-toggle-btn i').forEach(icon => {
        if (effectiveTheme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            if (icon.parentElement) icon.parentElement.title = 'Switch to Light Theme';
        } else {
            icon.className = 'fa-solid fa-moon';
            if (icon.parentElement) icon.parentElement.title = 'Switch to Dark Theme';
        }
    });
}

// Smart Navigation Preserving Tool Categories
function handleSmartBack(defaultFallback = 'tools.html') {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from) {
        window.location.href = from;
        return;
    }
    const lastCat = sessionStorage.getItem('last_tool_category');
    if (lastCat && defaultFallback.includes('tools.html')) {
        window.location.href = `tools.html?cat=${encodeURIComponent(lastCat)}`;
        return;
    }
    if (document.referrer && document.referrer.includes(window.location.host) && !document.referrer.endsWith(window.location.pathname)) {
        window.history.back();
        return;
    }
    window.location.href = defaultFallback;
}

// Docholder Local Storage & Recent Files Manager
const DocholderStorage = {
    getRecentFiles() {
        try {
            return JSON.parse(localStorage.getItem('docholder_recent_files') || '[]');
        } catch(e) {
            return [];
        }
    },
    addRecentFile(file) {
        if (!file) return;
        try {
            const name = file.originalName || file.original_name || file.name || 'document';
            let list = this.getRecentFiles().filter(f => f.name !== name);
            list.unshift({
                id: file.id || String(Date.now()),
                name: name,
                size: file.file_size || file.size || file.convertedSize || 0,
                type: file.file_type || file.type || 'doc',
                downloadUrl: file.downloadUrl || (file.id ? `/api/files/${file.id}/download` : null),
                timestamp: Date.now()
            });
            if (list.length > 20) list = list.slice(0, 20);
            localStorage.setItem('docholder_recent_files', JSON.stringify(list));
        } catch(e) {}
    },
    getFavorites() {
        try {
            return new Set(JSON.parse(localStorage.getItem('docholder_favorites') || '[]'));
        } catch(e) {
            return new Set();
        }
    },
    toggleFavorite(fileId) {
        const favs = this.getFavorites();
        const idStr = String(fileId);
        let isNowFav = false;
        if (favs.has(idStr)) {
            favs.delete(idStr);
        } else {
            favs.add(idStr);
            isNowFav = true;
        }
        localStorage.setItem('docholder_favorites', JSON.stringify(Array.from(favs)));
        return isNowFav;
    },
    isFavorite(fileId) {
        return this.getFavorites().has(String(fileId));
    },
    saveFileLocally(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Saved ${filename || 'file'} to device downloads`, 'success');
    }
};

// File & Folder Permission Manager
async function requestDocholderPermission(type = 'storage', reason = 'access your local files and media') {
    const key = `docholder_perm_${type}`;
    const status = localStorage.getItem(key);
    if (status === 'granted') return true;

    return new Promise((resolve) => {
        let modal = document.getElementById('docholder-permission-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'docholder-permission-modal';
            modal.className = 'modal-backdrop';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.7)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '99999';
            document.body.appendChild(modal);
        }

        const iconMap = {
            storage: 'fa-folder-open',
            camera: 'fa-camera',
            microphone: 'fa-microphone'
        };

        modal.innerHTML = `
            <div class="modal-dialog glass-card cyber-card" style="max-width: 320px; text-align: center; padding: 24px 18px; margin: 16px;">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px auto; font-size: 1.4rem;">
                    <i class="fa-solid ${iconMap[type] || 'fa-shield'}"></i>
                </div>
                <h3 style="font-size: 1.05rem; font-family: var(--font-hud); margin-bottom: 8px; color: var(--text);">Permission Request</h3>
                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 18px;">
                    Allow <strong>Docholder</strong> to ${reason}? This allows local processing and file saving on your device.
                </p>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button type="button" id="perm-btn-allow" class="btn btn-primary btn-block" style="font-size: 0.85rem; padding: 10px;">
                        Allow While Using App
                    </button>
                    <button type="button" id="perm-btn-deny" class="btn btn-secondary btn-block" style="font-size: 0.82rem; padding: 8px;">
                        Don't Allow
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        modal.querySelector('#perm-btn-allow').onclick = () => {
            modal.style.display = 'none';
            localStorage.setItem(key, 'granted');
            showToast(`${type.toUpperCase()} permission granted`, 'success');
            resolve(true);
        };

        modal.querySelector('#perm-btn-deny').onclick = () => {
            modal.style.display = 'none';
            localStorage.setItem(key, 'denied');
            showToast(`Permission denied. You can enable it in Settings.`, 'warning');
            resolve(false);
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcons(localStorage.getItem('docholder_theme') || 'dark');
});

// Docholder Settings Helper
function getDocholderSettings() {
    try {
        const raw = localStorage.getItem('docholder_settings');
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
        theme: 'dark',
        notificationsEnabled: true,
        notificationDuration: 4000,
        reducedMotion: false,
        highContrast: false,
        autoDownload: false,
        defaultCompression: 'optimal',
        defaultImageQuality: 85,
        defaultVideoQuality: 'balanced'
    };
}

function saveDocholderSettings(settings) {
    const current = getDocholderSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem('docholder_settings', JSON.stringify(merged));
    if (settings.theme) {
        setAppTheme(settings.theme, false);
    }
    applyThemeAndAccessibility();
}

function applyThemeAndAccessibility() {
    const settings = getDocholderSettings();
    if (settings.reducedMotion) {
        document.documentElement.classList.add('reduce-motion');
    } else {
        document.documentElement.classList.remove('reduce-motion');
    }

    if (settings.highContrast) {
        document.documentElement.classList.add('high-contrast');
    } else {
        document.documentElement.classList.remove('high-contrast');
    }
}

// In-App Toast Notification System (100% In-App, Never Desktop/OS Alerts)
function showToast(message, type = 'info', duration = null, action = null) {
    const settings = getDocholderSettings();
    if (settings.notificationsEnabled === false && type !== 'error') {
        return;
    }

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        
        const shell = document.querySelector('.mobile-app-shell');
        if (shell) {
            shell.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconMap = {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-triangle-exclamation',
        warning: 'fa-solid fa-circle-exclamation',
        info: 'fa-solid fa-circle-info',
        processing: 'fa-solid fa-circle-notch fa-spin'
    };

    const contentDiv = document.createElement('div');
    contentDiv.style.display = 'flex';
    contentDiv.style.alignItems = 'center';
    contentDiv.style.gap = '10px';
    contentDiv.style.flex = '1';
    contentDiv.innerHTML = `<i class="${iconMap[type] || iconMap.info}" style="font-size: 1.05rem;"></i> <span style="font-weight: 500; font-size: 0.85rem;">${message}</span>`;
    toast.appendChild(contentDiv);

    if (action && action.text && action.onClick) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.style.marginLeft = '8px';
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '0.75rem';
        btn.textContent = action.text;
        btn.onclick = (e) => {
            e.stopPropagation();
            action.onClick();
            toast.remove();
        };
        toast.appendChild(btn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.fontSize = '0.75rem';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    const activeDuration = duration !== null ? duration : (settings.notificationDuration || 4000);
    if (activeDuration > 0 && type !== 'processing') {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                setTimeout(() => toast.remove(), 250);
            }
        }, activeDuration);
    }

    return toast;
}

// In-App Inline Alert Banner
function showInlineAlert(containerEl, message, type = 'warning', action = null) {
    if (!containerEl) return null;
    const existing = containerEl.querySelector('.inline-alert-box');
    if (existing) existing.remove();

    const alertBox = document.createElement('div');
    alertBox.className = `inline-alert-box inline-alert-${type}`;
    alertBox.style.padding = '10px 14px';
    alertBox.style.borderRadius = 'var(--radius-sm)';
    alertBox.style.marginBottom = '12px';
    alertBox.style.display = 'flex';
    alertBox.style.alignItems = 'center';
    alertBox.style.justifyContent = 'space-between';
    alertBox.style.gap = '10px';
    alertBox.style.fontSize = '0.82rem';

    const colors = {
        error: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: '#EF4444', icon: 'fa-triangle-exclamation' },
        warning: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', color: '#F59E0B', icon: 'fa-circle-exclamation' },
        success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', color: '#10B981', icon: 'fa-circle-check' },
        info: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.35)', color: 'var(--primary)', icon: 'fa-circle-info' }
    };

    const scheme = colors[type] || colors.info;
    alertBox.style.background = scheme.bg;
    alertBox.style.border = `1px solid ${scheme.border}`;
    alertBox.style.color = 'var(--text)';

    alertBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <i class="fa-solid ${scheme.icon}" style="color: ${scheme.color}; font-size: 1rem;"></i>
            <span>${message}</span>
        </div>
    `;

    if (action && action.text && action.onClick) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm';
        btn.style.padding = '3px 8px';
        btn.style.fontSize = '0.74rem';
        btn.textContent = action.text;
        btn.onclick = () => {
            action.onClick();
            alertBox.remove();
        };
        alertBox.appendChild(btn);
    }

    containerEl.prepend(alertBox);
    return alertBox;
}

// Contextual Operation Loading Modal
function showOperationLoader(options = {}) {
    const title = options.title || 'Processing File...';
    const subtitle = options.subtitle || 'Please wait while Docholder optimizes your document.';
    const stages = options.stages || ['Preparing...', 'Analyzing format...', 'Processing transformation...', 'Finalizing result...'];
    const initialIndex = options.initialStageIndex || 0;

    let modal = document.getElementById('docholder-operation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'docholder-operation-modal';
        modal.className = 'operation-loader-overlay';
        modal.innerHTML = `
            <div class="operation-loader-card">
                <div class="operation-spinner-wrap">
                    <div class="operation-spinner-ring"></div>
                    <i id="op-loader-icon" class="fa-solid fa-gear fa-spin operation-spinner-icon"></i>
                </div>
                <h3 id="op-loader-title" style="margin: 12px 0 4px 0; font-size: 1.15rem; font-weight: 700; color: var(--text);"></h3>
                <p id="op-loader-subtitle" style="font-size: 0.84rem; color: var(--text-secondary); margin: 0 0 16px 0;"></p>
                
                <div id="op-loader-stages" class="operation-stages-list"></div>

                <div class="operation-loader-bar-track">
                    <div id="op-loader-bar-fill" class="operation-loader-bar-fill"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('op-loader-title').textContent = title;
    document.getElementById('op-loader-subtitle').textContent = subtitle;

    const stagesList = document.getElementById('op-loader-stages');
    stagesList.innerHTML = stages.map((s, idx) => `
        <div class="op-stage-item ${idx === initialIndex ? 'active' : (idx < initialIndex ? 'completed' : '')}" id="op-stage-${idx}">
            <i class="fa-solid ${idx < initialIndex ? 'fa-circle-check' : (idx === initialIndex ? 'fa-circle-notch fa-spin' : 'fa-circle')} op-stage-icon"></i>
            <span>${s}</span>
        </div>
    `).join('');

    const fillPercent = Math.min(100, Math.round(((initialIndex + 1) / stages.length) * 100));
    document.getElementById('op-loader-bar-fill').style.width = `${fillPercent}%`;

    modal.classList.add('visible');
}

function updateOperationStage(stageIndex, stageMessage = '') {
    const stageElements = document.querySelectorAll('.op-stage-item');
    stageElements.forEach((el, idx) => {
        el.classList.remove('active', 'completed');
        const icon = el.querySelector('.op-stage-icon');
        if (idx < stageIndex) {
            el.classList.add('completed');
            if (icon) icon.className = 'fa-solid fa-circle-check op-stage-icon';
        } else if (idx === stageIndex) {
            el.classList.add('active');
            if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin op-stage-icon';
            if (stageMessage) {
                const textSpan = el.querySelector('span');
                if (textSpan) textSpan.textContent = stageMessage;
            }
        } else {
            if (icon) icon.className = 'fa-solid fa-circle op-stage-icon';
        }
    });

    const total = stageElements.length || 4;
    const fillPercent = Math.min(100, Math.round(((stageIndex + 1) / total) * 100));
    const fill = document.getElementById('op-loader-bar-fill');
    if (fill) fill.style.width = `${fillPercent}%`;
}

function hideOperationLoader() {
    const modal = document.getElementById('docholder-operation-modal');
    if (modal) {
        modal.classList.remove('visible');
    }
}

// State Persistence Utilities (Safely avoids storing sensitive passwords)
function saveWorkspaceState(namespace, stateObj) {
    try {
        const sanitized = { ...stateObj };
        delete sanitized.password;
        delete sanitized.confirmPassword;
        delete sanitized.ownerPassword;
        sessionStorage.setItem(`docholder_ws_${namespace}`, JSON.stringify(sanitized));
    } catch(e) {}
}

function getWorkspaceState(namespace) {
    try {
        const raw = sessionStorage.getItem(`docholder_ws_${namespace}`);
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
}

function clearWorkspaceState(namespace) {
    try {
        sessionStorage.removeItem(`docholder_ws_${namespace}`);
    } catch(e) {}
}

// Resolves API endpoint URL (supports Web, Render, and Capacitor Native Mobile)
function resolveApiUrl(endpoint) {
    if (!endpoint || endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }
    const customHost = localStorage.getItem('docholder_api_host');
    if (customHost) {
        return `${customHost.replace(/\/+$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }
    const isCapacitor = window.Capacitor !== undefined || window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';
    if (isCapacitor && window.API_BASE_URL) {
        return `${window.API_BASE_URL.replace(/\/+$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }
    return endpoint;
}

// Main API Fetch Wrapper
async function apiFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Accept': 'application/json'
    };

    if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    options.headers = { ...defaultHeaders, ...options.headers };
    options.credentials = 'include'; // Send httpOnly JWT cookie

    try {
        const fullUrl = resolveApiUrl(endpoint);
        const response = await fetch(fullUrl, options);

        if (response.status === 401) {
            const currentPath = window.location.pathname;
            if (!currentPath.endsWith('login.html') && !currentPath.endsWith('register.html') && !currentPath.endsWith('welcome.html') && currentPath !== '/') {
                window.location.href = '/login.html?expired=1';
                return;
            }
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred.');
        }

        return data;
    } catch (err) {
        throw err;
    }
}

// Mobile Status Bar & Navigation Setup
async function initMobileAppEnvironment() {
    try {
        updateThemeIcons(savedTheme);
        
        // Add Floating View Switcher to desktop
        if (!document.getElementById('view-mode-toggle-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'view-mode-toggle-btn';
            toggleBtn.className = 'view-mode-toggle';
            toggleBtn.onclick = toggleViewMode;
            document.body.appendChild(toggleBtn);
            updateViewModeButtonText();
        }

        // Live Clock on Mobile Status Bar
        function updateClock() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            document.querySelectorAll('.status-bar-time').forEach(el => {
                el.textContent = timeStr;
            });
        }
        updateClock();
        setInterval(updateClock, 30000);

        // Fast User Info display with local session cache
        let user = null;
        try {
            const cached = sessionStorage.getItem('docholder_cached_user');
            if (cached) user = JSON.parse(cached);
        } catch(e) {}

        const applyUserToUI = (u) => {
            if (!u) return;
            document.querySelectorAll('.user-name-display, #dash-user-name').forEach(el => {
                el.textContent = u.name || 'User';
            });
            document.querySelectorAll('#nav-user-email, .user-email-display').forEach(el => {
                el.textContent = u.email || '';
            });
            document.querySelectorAll('.user-avatar, #nav-user-avatar').forEach(el => {
                if (u.profile_image) {
                    el.innerHTML = `<img src="${u.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                } else {
                    el.textContent = (u.name || 'U').charAt(0).toUpperCase();
                }
            });
        };

        if (user) {
            applyUserToUI(user);
        }

        // Non-blocking background sync
        apiFetch('/api/auth/me').then(res => {
            if (res && res.user) {
                applyUserToUI(res.user);
                try { sessionStorage.setItem('docholder_cached_user', JSON.stringify(res.user)); } catch(e) {}
            }
        }).catch(() => {});
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    initMobileAppEnvironment();
});

// Format byte sizes into human readable text
function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Heavy File Telemetry Inspector (Requirement 10)
 * Evaluates file size, formats, duration, limits (500MB), and computes estimated processing time & output size
 */
function renderHeavyFileInspector(containerEl, file, options = {}) {
    if (!containerEl || !file) return;
    
    const MAX_LIMIT_BYTES = 500 * 1024 * 1024; // 500MB
    const fileSize = file.file_size || file.size || 0;
    const isExceeding = fileSize > MAX_LIMIT_BYTES;
    const isHeavy = fileSize > 25 * 1024 * 1024; // > 25MB considered heavy

    const ext = (file.original_name || file.name || '').split('.').pop().toUpperCase();
    const duration = options.duration || file.duration || null;
    const actionType = options.actionType || 'process';

    // Estimation formulas
    let estTimeSeconds = 2;
    if (fileSize > 0) {
        const mb = fileSize / (1024 * 1024);
        if (options.mediaType === 'video') {
            estTimeSeconds = Math.max(3, Math.round(mb * 0.35 + (duration ? duration * 0.08 : 0)));
        } else if (options.mediaType === 'audio') {
            estTimeSeconds = Math.max(1, Math.round(mb * 0.2 + (duration ? duration * 0.04 : 0)));
        } else {
            estTimeSeconds = Math.max(1, Math.round(mb * 0.15));
        }
    }

    let estOutputSizeStr = 'Dynamic';
    if (fileSize > 0) {
        if (actionType === 'compress') {
            estOutputSizeStr = `~${formatBytes(Math.round(fileSize * 0.45))} (approx. 55% saved)`;
        } else if (actionType === 'extract') {
            estOutputSizeStr = `~${formatBytes(Math.round(fileSize * 0.08))} (audio stream)`;
        } else {
            estOutputSizeStr = `~${formatBytes(fileSize)} (standard target)`;
        }
    }

    const cardId = 'heavy-file-telemetry-box';
    let existing = document.getElementById(cardId);
    if (!existing) {
        existing = document.createElement('div');
        existing.id = cardId;
        containerEl.parentNode.insertBefore(existing, containerEl.nextSibling);
    }

    existing.innerHTML = `
        <div class="glass-card cyber-card" style="margin-top: 10px; padding: 12px; border: 1px solid ${isExceeding ? 'var(--danger)' : (isHeavy ? 'var(--warning)' : 'var(--cyan-neon)')}; background: var(--surface); color: var(--text);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="hud-badge ${isExceeding ? 'hud-badge-pink' : 'hud-badge-cyan'}" style="font-size: 0.65rem;">
                    <i class="fa-solid fa-microchip"></i> FILE TELEMETRY & CAPACITY
                </span>
                <span style="font-size: 0.7rem; font-family: var(--font-mono); color: ${isExceeding ? 'var(--danger)' : 'var(--text-secondary)'};">
                    MAX LIMIT: 500 MB
                </span>
            </div>

            ${isExceeding ? `
                <div style="background: rgba(239, 68, 68, 0.15); border-left: 3px solid var(--danger); padding: 8px 10px; border-radius: var(--radius-xs); font-size: 0.78rem; color: #FCA5A5; margin-bottom: 8px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> <strong>File Exceeds Limit:</strong> This file is ${formatBytes(fileSize)}, which exceeds the maximum 500MB capacity. Please select a smaller file.
                </div>
            ` : isHeavy ? `
                <div style="background: rgba(245, 158, 11, 0.12); border-left: 3px solid var(--warning); padding: 6px 10px; border-radius: var(--radius-xs); font-size: 0.75rem; color: #FDE68A; margin-bottom: 8px;">
                    <i class="fa-solid fa-gauge-high"></i> <strong>Heavy Media File:</strong> Large file detected. Processing will use background multithreading to avoid UI freezing.
                </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.76rem; font-family: var(--font-mono);">
                <div>
                    <span style="color: var(--text-secondary);">Format:</span> <strong>${ext || 'MEDIA'}</strong>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Size:</span> <strong style="color: var(--cyan-neon);">${formatBytes(fileSize)}</strong>
                </div>
                ${duration ? `
                <div>
                    <span style="color: var(--text-secondary);">Duration:</span> <strong>${Math.floor(duration)}s</strong>
                </div>
                ` : ''}
                <div>
                    <span style="color: var(--text-secondary);">Est. Processing:</span> <strong style="color: var(--emerald-neon);">~${estTimeSeconds}s</strong>
                </div>
                <div style="grid-column: span 2;">
                    <span style="color: var(--text-secondary);">Est. Output Size:</span> <strong>${estOutputSizeStr}</strong>
                </div>
            </div>
            <div style="margin-top: 6px; font-size: 0.68rem; color: var(--text-secondary); font-style: italic;">
                * Processing time depends on file size and device performance.
            </div>
        </div>
    `;
}

/**
 * Upload file with real-time XMLHttpRequest progress
 */
function uploadFileWithProgress(endpoint, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fullUrl = resolveApiUrl(endpoint);
        xhr.open('POST', fullUrl, true);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress({ stage: 'uploading', percent, loaded: e.loaded, total: e.total });
            }
        };

        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (onProgress) onProgress({ stage: 'ready', percent: 100 });
                    resolve(data);
                } else {
                    reject(new Error(data.error || 'Upload failed. Please try again.'));
                }
            } catch(e) {
                reject(new Error('Server returned an unexpected response.'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error occurred during file upload.'));
        xhr.ontimeout = () => reject(new Error('File upload timed out. Please try again.'));

        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
    });
}

/**
 * Universal File Upload & Preparation Tracker UI
 * Shows 4-stage upload progress: Selecting -> Loading -> Reading -> Preparing -> Ready
 */
function renderFileUploadTracker(containerEl, file) {
    if (!containerEl || !file) return null;

    const trackerId = 'docholder-upload-tracker-box';
    let tracker = document.getElementById(trackerId);
    if (!tracker) {
        tracker = document.createElement('div');
        tracker.id = trackerId;
        containerEl.parentNode.insertBefore(tracker, containerEl.nextSibling);
    }

    const ext = (file.name || file.original_name || '').split('.').pop().toUpperCase();
    const sizeStr = formatBytes(file.size || file.file_size || 0);

    tracker.innerHTML = `
        <div class="glass-card cyber-card" style="margin-top: 10px; padding: 12px; border: 1px solid var(--primary); background: var(--surface); color: var(--text);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="hud-badge hud-badge-cyan" style="font-size: 0.65rem;">${ext}</span>
                    <strong style="font-size: 0.82rem; font-family: var(--font-mono); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.name || file.original_name}</strong>
                </div>
                <span style="font-size: 0.72rem; color: var(--text-secondary); font-family: var(--font-mono);">${sizeStr}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;">
                <span id="tracker-status-label" style="color: var(--cyan-neon);"><i class="fa-solid fa-spinner fa-spin"></i> Loading document... 25%</span>
                <span id="tracker-percent-label" style="font-weight: 700; font-family: var(--font-mono);">25%</span>
            </div>

            <div class="progress-bar-container" style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                <div id="tracker-progress-fill" class="progress-bar-fill" style="width: 25%; height: 100%; background: linear-gradient(90deg, var(--cyan-neon), var(--magenta-neon)); transition: width 0.3s ease;"></div>
            </div>

            <div id="tracker-meta-notice" style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-secondary); margin-top: 6px;">
                <span>Status: Preparing file</span>
                <span id="tracker-est-time">Est: ~1-3s</span>
            </div>
        </div>
    `;

    return {
        update(percent, statusText, estText) {
            const fill = document.getElementById('tracker-progress-fill');
            const status = document.getElementById('tracker-status-label');
            const pct = document.getElementById('tracker-percent-label');
            const est = document.getElementById('tracker-est-time');

            if (fill) fill.style.width = `${percent}%`;
            if (pct) pct.textContent = `${percent}%`;
            if (status) status.innerHTML = percent >= 100 
                ? '<i class="fa-solid fa-circle-check" style="color:var(--emerald-neon);"></i> Your file is ready ✓' 
                : `<i class="fa-solid fa-spinner fa-spin"></i> ${statusText || 'Loading...'}`;
            if (est && estText) est.textContent = estText;
        },
        ready(filename) {
            this.update(100, 'Your file is ready ✓', 'Ready for conversion');
            const status = document.getElementById('tracker-status-label');
            if (status) status.innerHTML = '<strong style="color:var(--emerald-neon);"><i class="fa-solid fa-circle-check"></i> File ready for conversion ✓</strong>';
        },
        error(msg) {
            const status = document.getElementById('tracker-status-label');
            const fill = document.getElementById('tracker-progress-fill');
            if (status) status.innerHTML = `<span style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</span>`;
            if (fill) fill.style.background = 'var(--danger)';
        },
        remove() {
            if (tracker) tracker.remove();
        }
    };
}

/**
 * Docholder UI State Management
 */
const DocholderUI = {
    setButtonState(buttonEl, state, customText = null) {
        if (!buttonEl) return;
        if (state === 'disabled') {
            buttonEl.disabled = true;
            buttonEl.style.opacity = '0.55';
            buttonEl.style.cursor = 'not-allowed';
            if (customText) buttonEl.innerHTML = customText;
        } else if (state === 'enabled' || state === 'ready') {
            buttonEl.disabled = false;
            buttonEl.style.opacity = '1';
            buttonEl.style.cursor = 'pointer';
            if (customText) buttonEl.innerHTML = customText;
        } else if (state === 'loading') {
            buttonEl.disabled = true;
            buttonEl.style.opacity = '0.7';
            buttonEl.style.cursor = 'wait';
            buttonEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${customText || 'Processing...'}`;
        }
    },

    renderErrorCard(containerEl, message, onRetry = null) {
        if (!containerEl) return;
        const cardId = 'docholder-error-card';
        let card = document.getElementById(cardId);
        if (!card) {
            card = document.createElement('div');
            card.id = cardId;
            containerEl.appendChild(card);
        }

        card.innerHTML = `
            <div class="glass-card" style="margin-top: 14px; border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.12); padding: 14px;">
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <i class="fa-solid fa-circle-exclamation fa-2x" style="color: var(--danger); margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <h4 style="margin: 0; font-size: 0.92rem; color: #FCA5A5;">Operation Failed</h4>
                        <p style="margin: 4px 0 10px 0; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
                            ${message || "We couldn't convert this file. Please try again or select another file."}
                        </p>
                        ${onRetry ? `
                            <button id="btn-retry-operation" class="btn btn-primary btn-sm" style="background: var(--danger); border-color: var(--danger); font-size: 0.78rem;">
                                <i class="fa-solid fa-rotate-right"></i> Retry Conversion
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        if (onRetry) {
            document.getElementById('btn-retry-operation')?.addEventListener('click', () => {
                card.remove();
                onRetry();
            });
        }
    }
};

