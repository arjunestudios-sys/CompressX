// Docholder API Client, Mobile State & Notifications
(function checkNativePlatform() {
    const isNative = (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.getPlatform() === 'android' || window.Capacitor.getPlatform() === 'ios')) || window.location.protocol === 'file:';
    if (isNative) {
        document.documentElement.classList.add('is-native-app');
        if (document.body) document.body.classList.add('is-native-app');
        else document.addEventListener('DOMContentLoaded', () => document.body.classList.add('is-native-app'));
    }

    // Native Capacitor Plugins Lifecycle Hook
    if (window.Capacitor && window.Capacitor.Plugins) {
        const { StatusBar, SplashScreen, App, Network, LocalNotifications, Toast } = window.Capacitor.Plugins;

        // 1. Hide Splash Screen smoothly once UI starts
        if (SplashScreen && typeof SplashScreen.hide === 'function') {
            setTimeout(() => {
                SplashScreen.hide().catch(() => {});
            }, 600);
        }

        // 2. Set Status Bar Theme
        if (StatusBar && typeof StatusBar.setStyle === 'function') {
            StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
            if (typeof StatusBar.setBackgroundColor === 'function') {
                StatusBar.setBackgroundColor({ color: '#0b0f19' }).catch(() => {});
            }
        }

        // 3. Android Hardware Back Button Handling
        if (App && typeof App.addListener === 'function') {
            App.addListener('backButton', ({ canGoBack }) => {
                const openModal = document.querySelector('.modal-backdrop[style*="display: flex"], .modal-dialog-visible, #preview-modal:not(.hidden), #docholder-operation-modal.visible');
                if (openModal) {
                    if (openModal.id === 'preview-modal') openModal.classList.add('hidden');
                    else if (openModal.id === 'docholder-operation-modal') openModal.classList.remove('visible');
                    else openModal.style.display = 'none';
                    return;
                }

                const path = window.location.pathname;
                const isRoot = path.endsWith('dashboard.html') || path.endsWith('welcome.html') || path === '/' || path.endsWith('index.html');
                if (isRoot || !canGoBack) {
                    App.exitApp();
                } else {
                    window.history.back();
                }
            });
        }

        // 4. Offline / Online Network Monitoring
        if (Network && typeof Network.addListener === 'function') {
            Network.addListener('networkStatusChange', status => {
                if (!status.connected) {
                    if (typeof showToast === 'function') {
                        showToast('Internet disconnected. Some cloud operations may be unavailable.', 'warning', 5000);
                    }
                } else {
                    if (typeof showToast === 'function') {
                        showToast('Connected to cloud services.', 'success', 2500);
                    }
                }
            });
        }

        // 5. Local Notifications — Create channel + request permissions (Android 13+)
        if (LocalNotifications && typeof LocalNotifications.createChannel === 'function') {
            // Create notification channel for file operations
            LocalNotifications.createChannel({
                id: 'docholder_conversions',
                name: 'File Conversions',
                description: 'Notifications when file conversions and downloads are complete',
                importance: 3, // IMPORTANCE_DEFAULT
                visibility: 1,
                sound: 'default',
                lights: true,
                lightColor: '#4f8bff',
                vibration: true
            }).catch(() => {});

            // Request POST_NOTIFICATIONS permission (required Android 13+)
            LocalNotifications.checkPermissions().then(status => {
                if (status && status.display !== 'granted') {
                    LocalNotifications.requestPermissions().catch(() => {});
                }
            }).catch(() => {});

            // Handle notification tap — open file if downloadUrl is in extra data
            if (typeof LocalNotifications.addListener === 'function') {
                LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                    try {
                        const extra = action.notification && action.notification.extra;
                        if (extra && extra.downloadUrl) {
                            const fullUrl = (typeof resolveApiUrl === 'function') ? resolveApiUrl(extra.downloadUrl) : extra.downloadUrl;
                            window.location.href = `files.html?category=downloaded`;
                        }
                    } catch(e) {}
                });
            }
        }
    }
})();

// ─── DocholderNative: Native Plugin Wrappers ──────────────────────────────────
// Centralised access to @capacitor/toast, @capacitor/local-notifications,
// and @capacitor-community/file-opener so any page can call these features
// without worrying about plugin availability checks.
const DocholderNative = {

    /**
     * Show a native Android OS Toast (bottom of screen, no custom styling).
     * Falls back to the app's web showToast() on web/desktop.
     * @param {string} message
     * @param {'short'|'long'} duration
     */
    async nativeToast(message, duration = 'short') {
        try {
            const Toast = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Toast;
            if (Toast && typeof Toast.show === 'function') {
                await Toast.show({ text: message, duration });
                return;
            }
        } catch(e) {}
        // Web fallback
        if (typeof showToast === 'function') showToast(message, 'info', duration === 'long' ? 4000 : 2000);
    },

    /**
     * Fire a local push notification (works even when app is minimised).
     * Ideal for "Conversion complete" or "Download ready" alerts.
     * @param {object} opts
     * @param {string} opts.title     - Notification title
     * @param {string} opts.body      - Notification body text
     * @param {string} [opts.downloadUrl] - Stored in extra so tapping opens files
     * @param {number} [opts.delayMs] - Optional delay in ms before showing (default: 400ms)
     */
    async localNotify({ title, body, downloadUrl = null, delayMs = 400 } = {}) {
        try {
            const LocalNotifications = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
            if (!LocalNotifications || typeof LocalNotifications.schedule !== 'function') return;

            // Check permission before scheduling
            let status = { display: 'granted' };
            try { status = await LocalNotifications.checkPermissions(); } catch(e) {}

            if (status.display !== 'granted') {
                try { await LocalNotifications.requestPermissions(); } catch(e) { return; }
            }

            const notifId = Math.floor(Math.random() * 2147483647);
            await LocalNotifications.schedule({
                notifications: [{
                    id: notifId,
                    title: title || 'Docholder',
                    body: body || 'Your file is ready.',
                    channelId: 'docholder_conversions',
                    schedule: { at: new Date(Date.now() + delayMs) },
                    sound: 'default',
                    smallIcon: 'ic_stat_icon_config_sample',
                    iconColor: '#4f8bff',
                    actionTypeId: '',
                    extra: { downloadUrl }
                }]
            });
        } catch(err) {
            console.warn('[DocholderNative] localNotify error:', err);
        }
    },

    /**
     * Open a saved file in the device's default native app
     * (e.g. PDF → Google PDF Viewer, JPEG → Gallery).
     * Uses @capacitor-community/file-opener.
     * @param {string} filePath   - Native file URI (e.g. file:///data/user/...)
     * @param {string} mimeType   - MIME type string (e.g. 'application/pdf')
     */
    async openFileNative(filePath, mimeType = 'application/octet-stream') {
        try {
            const FileOpener = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FileOpener;
            if (FileOpener && typeof FileOpener.open === 'function') {
                await FileOpener.open({ filePath, contentType: mimeType });
                return;
            }
            // Fallback: try Capacitor Share plugin
            const SharePlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
            if (SharePlugin && typeof SharePlugin.share === 'function') {
                await SharePlugin.share({ title: 'Open File', url: filePath, dialogTitle: 'Open with' });
                return;
            }
        } catch(err) {
            console.warn('[DocholderNative] openFileNative error:', err);
        }
        // Web fallback \u2014 open in new tab
        try { window.open(filePath, '_blank'); } catch(e) {}
    }
};

window.DocholderNative = DocholderNative;

// Initialize Theme
const savedTheme = localStorage.getItem('docholder_theme') || 'light';
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
    const validTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'light';
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
    const current = document.documentElement.getAttribute('data-theme') || 'light';
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

// Path recovery: If WebView accidentally lands in an API subpath (e.g. /api/files/...)
(function recoverCorruptedPath() {
    if (window.location.pathname.includes('/api/')) {
        window.location.replace('/dashboard.html');
    }
})();

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function escapeAttr(str) {
    return escapeHtml(str);
}

// Smart Navigation Preserving Tool Categories
function handleSmartBack(defaultFallback = '/tools.html') {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from) {
        window.location.href = from.startsWith('/') || from.startsWith('http') ? from : `/${from}`;
        return;
    }
    const lastCat = sessionStorage.getItem('last_tool_category');
    if (lastCat && defaultFallback.includes('tools.html')) {
        window.location.href = `/tools.html?cat=${encodeURIComponent(lastCat)}`;
        return;
    }
    if (document.referrer && document.referrer.includes(window.location.host) && !document.referrer.endsWith(window.location.pathname)) {
        window.history.back();
        return;
    }
    window.location.href = defaultFallback.startsWith('/') || defaultFallback.startsWith('http') ? defaultFallback : `/${defaultFallback}`;
}

// Docholder Local Storage, Download Manager & Recent Files Manager
const DocholderStorage = {
    _getUserKey(prefix) {
        try {
            const userStr = localStorage.getItem('docholder_user_cache') || sessionStorage.getItem('docholder_user');
            if (userStr) {
                const u = JSON.parse(userStr);
                const uid = u.id || u.user_id || u.email;
                if (uid) return `${prefix}_${uid}`;
            }
        } catch(e) {}
        return prefix;
    },
    getRecentFiles() {
        try {
            return JSON.parse(localStorage.getItem(this._getUserKey('docholder_recent_files')) || '[]');
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
                original_name: name,
                size: file.file_size || file.size || file.convertedSize || 0,
                file_size: file.file_size || file.size || file.convertedSize || 0,
                type: file.file_type || file.type || 'doc',
                mime_type: file.mime_type || file.mimetype || 'application/octet-stream',
                downloadUrl: file.downloadUrl || (file.id ? `/api/files/${file.id}/download` : null),
                timestamp: Date.now()
            });
            if (list.length > 25) list = list.slice(0, 25);
            localStorage.setItem(this._getUserKey('docholder_recent_files'), JSON.stringify(list));
        } catch(e) {}
    },
    getFavorites() {
        try {
            return new Set(JSON.parse(localStorage.getItem(this._getUserKey('docholder_favorites')) || '[]'));
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
        localStorage.setItem(this._getUserKey('docholder_favorites'), JSON.stringify(Array.from(favs)));
        return isNowFav;
    },
    isFavorite(fileId) {
        return this.getFavorites().has(String(fileId));
    },
    getDownloadedFiles() {
        try {
            const raw = JSON.parse(localStorage.getItem(this._getUserKey('docholder_downloaded_files')) || '[]');
            return raw.filter(f => f && (f.name || f.original_name) && f.file_size !== undefined);
        } catch(e) {
            return [];
        }
    },
    addDownloadedFile(file) {
        if (!file || !(file.name || file.original_name)) return;
        try {
            const name = file.original_name || file.name;
            let list = this.getDownloadedFiles();
            const existingIdx = list.findIndex(f => (f.original_name || f.name) === name);
            const record = {
                id: file.id || (existingIdx >= 0 ? list[existingIdx].id : `dl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
                name: name,
                original_name: name,
                file_size: file.file_size || file.size || 0,
                file_type: file.file_type || file.type || 'doc',
                mime_type: file.mime_type || file.mimetype || 'application/octet-stream',
                downloadUrl: file.downloadUrl || null,
                storage_folder: 'Docholder',
                local_path: file.local_path || `Documents/Docholder/${name}`,
                downloaded_at: Date.now(),
                created_at: new Date().toISOString()
            };
            if (existingIdx >= 0) {
                list[existingIdx] = record;
            } else {
                list.unshift(record);
            }
            if (list.length > 50) list = list.slice(0, 50);
            localStorage.setItem(this._getUserKey('docholder_downloaded_files'), JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('docholder:file-downloaded', { detail: record }));
        } catch(e) {}
    },
    removeDownloadedFile(fileId) {
        try {
            let list = this.getDownloadedFiles().filter(f => String(f.id) !== String(fileId));
            localStorage.setItem(this._getUserKey('docholder_downloaded_files'), JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('docholder:file-downloaded'));
            return true;
        } catch(e) {
            return false;
        }
    },
    clearDownloadedFiles() {
        try {
            localStorage.removeItem(this._getUserKey('docholder_downloaded_files'));
            window.dispatchEvent(new CustomEvent('docholder:file-downloaded'));
        } catch(e) {}
    },

    /**
     * Real File Download Mechanism with Storage Verification:
     * 1. Download file content from server.
     * 2. Save actual file to accessible device storage (Public Documents/Docholder or Download/Docholder).
     * 3. Verify file exists and size > 0 on device storage.
     * 4. Only display "Download completed: <filename>" after verified write.
     * 5. If write or verification fails, display "Download failed – Please try again."
     */
    async saveFileLocally(url, filename) {
        if (!url) return;
        const name = filename || 'document';
        try {
            const fullUrl = (typeof resolveApiUrl === 'function') ? resolveApiUrl(url) : url;
            
            const authToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
            const headers = {};
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(fullUrl, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }

            const blob = await response.blob();
            if (!blob || blob.size === 0) {
                throw new Error('Downloaded file payload is empty (0 bytes).');
            }

            const ext = name.split('.').pop().toLowerCase();
            let category = 'doc';
            if (['jpg','jpeg','png','webp','gif','svg','bmp'].includes(ext)) category = 'image';
            else if (['mp4','webm','mov','mkv','avi'].includes(ext)) category = 'video';
            else if (['mp3','wav','aac','ogg','m4a','flac'].includes(ext)) category = 'audio';
            else if (['zip','tar','gz','rar','7z'].includes(ext)) category = 'archive';
            else if (['txt','json','js','css','html','py','md','csv'].includes(ext)) category = 'text';

            const isNative = (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.getPlatform() === 'android' || window.Capacitor.getPlatform() === 'ios'));
            let savedNative = false;
            let verified = false;
            let finalLocalPath = `Documents/Docholder/${name}`;
            let verifiedSize = blob.size;

            // 1. Native Mobile Storage Write Flow (Accessible in File Manager)
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
                const { Filesystem } = window.Capacitor.Plugins;
                try {
                    // Request runtime storage permissions
                    try {
                        await Filesystem.requestPermissions();
                    } catch(permErr) {
                        console.warn('[DocholderStorage] Permission request notice:', permErr);
                    }

                    const base64Data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const res = reader.result;
                            if (typeof res === 'string') {
                                resolve(res.includes(',') ? res.split(',')[1] : res);
                            } else {
                                resolve('');
                            }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    if (!base64Data) {
                        throw new Error('Could not convert file data to binary buffer.');
                    }

                    // Storage targets in order of accessibility to the device's File Manager:
                    const storageTargets = [
                        { directory: 'DOCUMENTS', path: `Docholder/${name}` },
                        { directory: 'EXTERNAL_STORAGE', path: `Download/Docholder/${name}` },
                        { directory: 'EXTERNAL', path: `Docholder/${name}` },
                        { directory: 'DATA', path: `docholder/${name}` }
                    ];

                    let writtenTarget = null;
                    for (const target of storageTargets) {
                        try {
                            const writeRes = await Filesystem.writeFile({
                                path: target.path,
                                data: base64Data,
                                directory: target.directory,
                                recursive: true
                            });
                            if (writeRes) {
                                writtenTarget = target;
                                break;
                            }
                        } catch(targetErr) {
                            console.warn(`[DocholderStorage] Write failed for directory ${target.directory}:`, targetErr.message);
                        }
                    }

                    if (writtenTarget) {
                        // 2. Strict Verification: stat file to ensure it physically exists and size > 0
                        const statRes = await Filesystem.stat({
                            path: writtenTarget.path,
                            directory: writtenTarget.directory
                        });

                        if (statRes && statRes.size > 0) {
                            verified = true;
                            savedNative = true;
                            verifiedSize = statRes.size;

                            try {
                                const uriRes = await Filesystem.getUri({
                                    path: writtenTarget.path,
                                    directory: writtenTarget.directory
                                });
                                finalLocalPath = (uriRes && uriRes.uri) ? uriRes.uri : writtenTarget.path;
                            } catch(uErr) {
                                finalLocalPath = writtenTarget.path;
                            }
                        } else {
                            throw new Error('File existence check returned 0 bytes.');
                        }
                    } else {
                        throw new Error('Unable to write to any accessible storage directory.');
                    }
                } catch(nativeErr) {
                    console.error('[DocholderStorage] Native write/verify error:', nativeErr);
                    if (isNative) {
                        throw nativeErr; // On native app, fail explicitly if storage write was not verified
                    }
                }
            }

            // 2. Web Browser Fallback (When not on native Android)
            if (!isNative && !savedNative) {
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    try {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    } catch(e) {}
                }, 2000);
                verified = true;
            }

            if (!verified) {
                throw new Error('File could not be verified in device storage.');
            }

            // 3. Record into Verified Downloaded Files collection
            const downloadedRecord = {
                id: `dl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: name,
                original_name: name,
                file_size: verifiedSize,
                file_type: category,
                mime_type: blob.type || 'application/octet-stream',
                downloadUrl: url,
                storage_folder: 'Docholder',
                local_path: finalLocalPath,
                downloaded_at: Date.now()
            };
            this.addDownloadedFile(downloadedRecord);
            this.addRecentFile(downloadedRecord);

            // 4. In-App Notification: Only display after physical save and verification
            const successMsg = `Download completed: ${name}`;
            if (typeof showToast === 'function') {
                showToast(successMsg, 'success', 3500);
            }

            // Native OS Toast & Notification if on device
            if (typeof DocholderNative !== 'undefined') {
                if (DocholderNative.nativeToast) {
                    DocholderNative.nativeToast(successMsg, 'short').catch(() => {});
                }
                if (DocholderNative.localNotify) {
                    DocholderNative.localNotify({
                        title: `Download completed: ${name}`,
                        body: 'Saved to device storage. Tap to view.',
                        downloadUrl: url,
                        filePath: finalLocalPath,
                        mimeType: blob.type || 'application/octet-stream',
                        delayMs: 250
                    }).catch(() => {});
                }
            }

            // 5. STOP — Download completed and verified
            return downloadedRecord;
        } catch(err) {
            console.error('saveFileLocally failure:', err);
            const failMsg = `Download failed: ${name}`;
            if (typeof showToast === 'function') {
                showToast(failMsg, 'error', 4000);
                setTimeout(() => {
                    showToast('Download failed – Please try again.', 'warning', 3000);
                }, 1000);
            }
            if (typeof DocholderNative !== 'undefined' && DocholderNative.nativeToast) {
                DocholderNative.nativeToast(failMsg, 'long').catch(() => {});
            }
            throw err;
        }
    },

    /**
     * Share functionality (Completely separate from download):
     * 1. Prepare the selected user-uploaded file.
     * 2. Attach the file to the Share Intent.
     * 3. Open the Android Share Sheet.
     * 4. Allow the user to select an available sharing application.
     * (NEVER triggers download)
     */
    async shareFile(url, filename, mimeType = 'application/octet-stream') {
        if (!url) return;
        try {
            const name = filename || 'document';
            const fullUrl = (typeof resolveApiUrl === 'function') ? resolveApiUrl(url) : url;

            // Strategy A: Capacitor Native Share Plugin (Mobile Android / iOS)
            const SharePlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
            const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;

            if (SharePlugin && typeof SharePlugin.share === 'function') {
                let shareUri = fullUrl;

                // Try to write file to cache to get a local shareable content URI
                if (Filesystem) {
                    try {
                        const authToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
                        const headers = {};
                        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
                        
                        const response = await fetch(fullUrl, { method: 'GET', headers, credentials: 'include' });
                        if (response.ok) {
                            const blob = await response.blob();
                            const base64Data = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const res = reader.result;
                                    resolve(typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });

                            const writeRes = await Filesystem.writeFile({
                                path: `docholder_share/${name}`,
                                data: base64Data,
                                directory: 'CACHE',
                                recursive: true
                            });
                            if (writeRes && writeRes.uri) {
                                shareUri = writeRes.uri;
                            }
                        }
                    } catch(prepErr) {
                        console.warn('[DocholderStorage] Preparing share file cached URI failed, using URL:', prepErr);
                    }
                }

                await SharePlugin.share({
                    title: name,
                    text: `Shared from Docholder: ${name}`,
                    url: shareUri,
                    dialogTitle: `Share "${name}"`
                });
                return;
            }

            // Strategy B: Web Share API (Desktop / Mobile Browser)
            if (navigator.share) {
                try {
                    // Try sharing file blob if supported
                    const authToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
                    const headers = {};
                    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
                    
                    const response = await fetch(fullUrl, { method: 'GET', headers, credentials: 'include' });
                    if (response.ok) {
                        const blob = await response.blob();
                        const fileObj = new File([blob], name, { type: mimeType || blob.type || 'application/octet-stream' });
                        if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
                            await navigator.share({
                                title: name,
                                text: `Shared from Docholder: ${name}`,
                                files: [fileObj]
                            });
                            return;
                        }
                    }
                } catch(fileShareErr) {}

                // Fallback to URL sharing
                await navigator.share({
                    title: name,
                    text: `Shared from Docholder: ${name}`,
                    url: fullUrl
                });
                return;
            }

            // Strategy C: Clipboard fallback
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(fullUrl);
                if (typeof showToast === 'function') {
                    showToast('Link copied to clipboard for sharing', 'info');
                }
            }
        } catch(err) {
            // Ignore user cancellation in Share Sheet
            if (err && err.message && !err.message.toLowerCase().includes('cancel') && !err.message.toLowerCase().includes('abort')) {
                console.warn('Share error:', err);
                if (typeof showToast === 'function') {
                    showToast(`Share failed: ${err.message}`, 'error');
                }
            }
        }
    }
};

window.downloadFile = (url, name) => DocholderStorage.saveFileLocally(url, name);
window.shareFile = (url, name, mime) => DocholderStorage.shareFile(url, name, mime);

// ─── Universal High-Fidelity In-App Mobile Preview Engine ─────────────────────
const DocholderPreview = {
    modalEl: null,
    currentDocData: null,
    pdfInstance: null,
    pdfPage: 1,
    pdfTotalPages: 1,
    pdfScale: 1.0,

    ensureModal() {
        if (this.modalEl && document.body.contains(this.modalEl)) return this.modalEl;
        
        let existing = document.getElementById('docholder-universal-preview-modal');
        if (existing) {
            this.modalEl = existing;
            return this.modalEl;
        }

        const modal = document.createElement('div');
        modal.id = 'docholder-universal-preview-modal';
        modal.className = 'modal-overlay hidden';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.82); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box;';

        modal.innerHTML = `
            <div class="docholder-preview-card" style="background: var(--surface-card, #111827); border: 1px solid var(--surface-border, rgba(0,240,255,0.3)); border-radius: 16px; width: 100%; max-width: 600px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.7); animation: modalScaleIn 0.2s ease;">
                
                <!-- Modal Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--surface-border, rgba(255,255,255,0.1)); background: rgba(0,0,0,0.25);">
                    <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
                        <i id="preview-modal-icon" class="fa-solid fa-file" style="font-size: 1.25rem; color: var(--primary);"></i>
                        <div style="overflow: hidden; min-width: 0;">
                            <h4 id="preview-modal-title" style="margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--text, #fff); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Document Preview</h4>
                            <span id="preview-modal-meta" style="font-size: 0.72rem; color: var(--text-secondary, #94A3B8);">Loading metadata...</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" id="preview-btn-share-header" class="icon-btn" style="width: 32px; height: 32px; font-size: 0.85rem; border-radius: 8px;" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
                        <button type="button" id="preview-btn-close" class="icon-btn" style="width: 32px; height: 32px; font-size: 0.9rem; border-radius: 8px;" title="Close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>

                <!-- Modal Content Area -->
                <div id="preview-modal-body" style="flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; background: rgba(0,0,0,0.15);">
                    <div style="text-align: center; color: var(--text-secondary); padding: 30px;">
                        <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--primary);"></i>
                        <p style="margin-top: 10px; font-size: 0.85rem;">Loading document preview...</p>
                    </div>
                </div>

                <!-- PDF Floating Controls Bar (Hidden for non-PDF) -->
                <div id="preview-pdf-toolbar" class="hidden" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; background: rgba(15,23,42,0.9); border-top: 1px solid var(--surface-border, rgba(255,255,255,0.08)); font-size: 0.78rem;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" id="pdf-prev-page-btn" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.75rem;"><i class="fa-solid fa-chevron-left"></i></button>
                        <span id="pdf-page-indicator" style="font-family: var(--font-mono, monospace); font-weight: 700; color: var(--cyan-neon, #00f0ff);">1 / 1</span>
                        <button type="button" id="pdf-next-page-btn" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.75rem;"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" id="pdf-zoom-out-btn" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.75rem;"><i class="fa-solid fa-minus"></i></button>
                        <span id="pdf-zoom-level" style="font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--text-secondary);">100%</span>
                        <button type="button" id="pdf-zoom-in-btn" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.75rem;"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>

                <!-- Modal Action Footer -->
                <div style="display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--surface-border, rgba(255,255,255,0.1)); background: rgba(0,0,0,0.25);">
                    <button type="button" id="preview-modal-download-btn" class="btn btn-primary" style="flex: 1; font-size: 0.85rem; padding: 10px 14px;">
                        <i class="fa-solid fa-download"></i> Save to Docholder
                    </button>
                    <button type="button" id="preview-modal-open-studio-btn" class="btn btn-secondary" style="font-size: 0.85rem; padding: 10px 14px;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Edit
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modalEl = modal;

        // Wire modal event listeners
        modal.querySelector('#preview-btn-close').onclick = () => this.close();
        modal.onclick = (e) => {
            if (e.target === modal) this.close();
        };

        return modal;
    },

    close() {
        if (this.modalEl) {
            this.modalEl.classList.add('hidden');
            this.modalEl.style.display = 'none';
        }
        this.currentDocData = null;
        this.pdfInstance = null;
    },

    async open(fileOrUrl, originalName = null, mimeType = null, fileId = null) {
        const modal = this.ensureModal();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        let targetUrl = '';
        let name = originalName || 'document';
        let mime = mimeType || '';
        let id = fileId || null;
        let size = 0;

        if (typeof fileOrUrl === 'object' && fileOrUrl !== null) {
            id = fileOrUrl.id || id;
            name = fileOrUrl.original_name || fileOrUrl.originalName || fileOrUrl.name || name;
            mime = fileOrUrl.mime_type || fileOrUrl.mimetype || mime;
            size = fileOrUrl.file_size || fileOrUrl.size || fileOrUrl.convertedSize || size;
            targetUrl = fileOrUrl.downloadUrl || (id ? `/api/files/${id}/download?inline=true` : '');
        } else if (typeof fileOrUrl === 'string') {
            targetUrl = fileOrUrl;
        }

        if (!targetUrl && id) {
            targetUrl = `/api/files/${id}/download?inline=true`;
        }

        const fullDownloadUrl = (typeof resolveApiUrl === 'function') ? resolveApiUrl(targetUrl) : targetUrl;
        this.currentDocData = { id, name, mime, size, url: fullDownloadUrl };

        const ext = name.split('.').pop().toLowerCase();
        const iconMap = {
            pdf: 'fa-solid fa-file-pdf',
            doc: 'fa-solid fa-file-word',
            docx: 'fa-solid fa-file-word',
            xls: 'fa-solid fa-file-excel',
            xlsx: 'fa-solid fa-file-excel',
            csv: 'fa-solid fa-file-csv',
            jpg: 'fa-solid fa-file-image',
            jpeg: 'fa-solid fa-file-image',
            png: 'fa-solid fa-file-image',
            webp: 'fa-solid fa-file-image',
            mp4: 'fa-solid fa-file-video',
            mp3: 'fa-solid fa-file-audio',
            wav: 'fa-solid fa-file-audio',
            zip: 'fa-solid fa-file-zipper'
        };

        const iconEl = modal.querySelector('#preview-modal-icon');
        const titleEl = modal.querySelector('#preview-modal-title');
        const metaEl = modal.querySelector('#preview-modal-meta');
        const bodyEl = modal.querySelector('#preview-modal-body');
        const pdfToolbar = modal.querySelector('#preview-pdf-toolbar');
        const dlBtn = modal.querySelector('#preview-modal-download-btn');
        const studioBtn = modal.querySelector('#preview-modal-open-studio-btn');
        const shareBtn = modal.querySelector('#preview-btn-share-header');

        if (iconEl) iconEl.className = iconMap[ext] || 'fa-solid fa-file';
        if (titleEl) titleEl.textContent = name;
        if (metaEl) metaEl.textContent = `${ext.toUpperCase()} Document • ${formatBytes(size)}`;
        if (pdfToolbar) pdfToolbar.classList.add('hidden');

        // Setup Download & Share Actions
        if (dlBtn) {
            dlBtn.onclick = () => {
                DocholderStorage.saveFileLocally(fullDownloadUrl, name);
            };
        }

        if (shareBtn) {
            shareBtn.onclick = () => {
                DocholderStorage.shareFile(fullDownloadUrl, name, mime);
            };
        }

        if (studioBtn) {
            let studioUrl = `convert.html${id ? '?fileId=' + id : ''}`;
            if (['jpg','jpeg','png','webp','gif'].includes(ext)) studioUrl = `image-tools.html${id ? '?fileId=' + id : ''}`;
            else if (['mp4','webm','mov'].includes(ext)) studioUrl = `video-tools.html${id ? '?fileId=' + id : ''}`;
            else if (['mp3','wav','aac'].includes(ext)) studioUrl = `audio-tools.html${id ? '?fileId=' + id : ''}`;
            else if (['pdf'].includes(ext)) studioUrl = `document-tools.html${id ? '?fileId=' + id : ''}`;
            else if (['doc','docx'].includes(ext)) studioUrl = `word-tools.html${id ? '?fileId=' + id : ''}`;
            
            studioBtn.onclick = () => {
                window.location.href = studioUrl;
            };
        }

        // Render appropriate media viewer
        bodyEl.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 30px;"><i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--primary);"></i><p style="margin-top: 10px; font-size: 0.85rem;">Rendering document...</p></div>';

        try {
            const authToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
            const headers = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

            // 1. PDF Preview with PDF.js Canvas Rendering (100% Mobile Compatible)
            if (ext === 'pdf' || (mime && mime.includes('pdf'))) {
                await this.renderPdfPreview(bodyEl, fullDownloadUrl, headers, pdfToolbar);
            }
            // 2. Image Preview
            else if (['jpg','jpeg','png','webp','gif','svg','bmp','ico'].includes(ext) || (mime && mime.startsWith('image/'))) {
                const imgRes = await fetch(fullDownloadUrl, { headers, credentials: 'include' });
                const blob = await imgRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                bodyEl.innerHTML = `
                    <div style="width: 100%; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 10px; overflow: hidden; padding: 8px;">
                        <img src="${blobUrl}" alt="${escapeAttr(name)}" style="max-width: 100%; max-height: 55vh; object-fit: contain; border-radius: 6px;">
                    </div>
                `;
            }
            // 3. Audio Preview
            else if (['mp3','wav','aac','ogg','m4a','flac'].includes(ext) || (mime && mime.startsWith('audio/'))) {
                const audRes = await fetch(fullDownloadUrl, { headers, credentials: 'include' });
                const blob = await audRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                bodyEl.innerHTML = `
                    <div style="width: 100%; background: var(--surface, #1e293b); padding: 24px 16px; border-radius: 12px; border: 1px solid var(--surface-border); text-align: center;">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--primary-light, rgba(0,240,255,0.15)); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 1.6rem;">
                            <i class="fa-solid fa-music"></i>
                        </div>
                        <h4 style="font-size: 0.9rem; margin-bottom: 12px;">${name}</h4>
                        <audio controls autoplay style="width: 100%;">
                            <source src="${blobUrl}">
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                `;
            }
            // 4. Video Preview
            else if (['mp4','webm','mov','mkv','avi'].includes(ext) || (mime && mime.startsWith('video/'))) {
                const vidRes = await fetch(fullDownloadUrl, { headers, credentials: 'include' });
                const blob = await vidRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                bodyEl.innerHTML = `
                    <div style="width: 100%; background: #000; border-radius: 10px; overflow: hidden;">
                        <video controls playsinline autoplay muted style="width: 100%; max-height: 50vh; display: block;">
                            <source src="${blobUrl}">
                            Your browser does not support video playback.
                        </video>
                    </div>
                `;
            }
            // 5. Spreadsheets (XLSX, XLS, CSV)
            else if (['xlsx','xls','csv'].includes(ext)) {
                await this.renderSpreadsheetPreview(bodyEl, fullDownloadUrl, headers);
            }
            // 6. Word Documents (DOCX)
            else if (['docx','doc'].includes(ext)) {
                await this.renderWordDocPreview(bodyEl, fullDownloadUrl, headers, name);
            }
            // 7. Code & Text
            else if (['txt','json','js','css','html','py','md','xml','log'].includes(ext) || (mime && mime.startsWith('text/'))) {
                const textRes = await fetch(fullDownloadUrl, { headers, credentials: 'include' });
                const text = await textRes.text();
                bodyEl.innerHTML = `
                    <div style="width: 100%; max-height: 55vh; overflow-y: auto; background: #0f172a; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); padding: 12px;">
                        <pre style="font-family: monospace; font-size: 0.78rem; line-height: 1.5; color: #e2e8f0; margin: 0; white-space: pre-wrap; word-break: break-all;">${escapeHtml(text.slice(0, 50000))}</pre>
                    </div>
                `;
            }
            // 8. Default Generic File Card
            else {
                bodyEl.innerHTML = `
                    <div style="text-align: center; padding: 24px 12px;">
                        <i class="fa-solid fa-file-circle-check fa-3x" style="color: var(--primary); margin-bottom: 12px;"></i>
                        <h4 style="font-size: 0.95rem; margin-bottom: 6px;">${name}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); max-width: 320px; margin: 0 auto 16px auto;">
                            Direct inline preview is not supported for this format. You can save it directly to your Docholder folder or open it in Studio.
                        </p>
                    </div>
                `;
            }
        } catch(err) {
            console.error('DocholderPreview error:', err);
            bodyEl.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--danger);">
                    <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
                    <p style="margin-top: 8px; font-size: 0.85rem;">Preview unavailable: ${err.message}</p>
                    <button class="btn btn-secondary btn-sm" onclick="DocholderStorage.saveFileLocally('${fullDownloadUrl}', '${escapeAttr(name)}')" style="margin-top: 10px;">
                        <i class="fa-solid fa-download"></i> Download File
                    </button>
                </div>
            `;
        }
    },

    async renderPdfPreview(containerEl, url, headers, toolbarEl) {
        // Load PDF.js dynamically if not present
        if (typeof window.pdfjsLib === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
                script.onload = () => {
                    if (window.pdfjsLib) {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                    }
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const res = await fetch(url, { headers, credentials: 'include' });
        const arrayBuffer = await res.arrayBuffer();

        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        this.pdfInstance = pdf;
        this.pdfPage = 1;
        this.pdfTotalPages = pdf.numPages;
        this.pdfScale = 1.15;

        containerEl.innerHTML = `
            <div id="pdf-preview-scroll-container" style="width: 100%; max-height: 55vh; overflow: auto; display: flex; justify-content: center; background: #334155; border-radius: 8px; padding: 8px; box-sizing: border-box;">
                <canvas id="docholder-pdf-preview-canvas" style="box-shadow: 0 4px 20px rgba(0,0,0,0.4); max-width: 100%; height: auto;"></canvas>
            </div>
        `;

        if (toolbarEl) {
            toolbarEl.classList.remove('hidden');
            const pageIndicator = toolbarEl.querySelector('#pdf-page-indicator');
            const zoomIndicator = toolbarEl.querySelector('#pdf-zoom-level');
            const prevBtn = toolbarEl.querySelector('#pdf-prev-page-btn');
            const nextBtn = toolbarEl.querySelector('#pdf-next-page-btn');
            const zoomInBtn = toolbarEl.querySelector('#pdf-zoom-in-btn');
            const zoomOutBtn = toolbarEl.querySelector('#pdf-zoom-out-btn');

            const renderCurrentPage = async () => {
                const canvas = document.getElementById('docholder-pdf-preview-canvas');
                if (!canvas || !this.pdfInstance) return;
                const page = await this.pdfInstance.getPage(this.pdfPage);
                const viewport = page.getViewport({ scale: this.pdfScale });
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: ctx, viewport }).promise;

                if (pageIndicator) pageIndicator.textContent = `${this.pdfPage} / ${this.pdfTotalPages}`;
                if (zoomIndicator) zoomIndicator.textContent = `${Math.round(this.pdfScale * 100)}%`;
            };

            prevBtn.onclick = () => {
                if (this.pdfPage > 1) {
                    this.pdfPage--;
                    renderCurrentPage();
                }
            };
            nextBtn.onclick = () => {
                if (this.pdfPage < this.pdfTotalPages) {
                    this.pdfPage++;
                    renderCurrentPage();
                }
            };
            zoomInBtn.onclick = () => {
                if (this.pdfScale < 2.5) {
                    this.pdfScale += 0.2;
                    renderCurrentPage();
                }
            };
            zoomOutBtn.onclick = () => {
                if (this.pdfScale > 0.6) {
                    this.pdfScale -= 0.2;
                    renderCurrentPage();
                }
            };

            await renderCurrentPage();
        }
    },

    async renderSpreadsheetPreview(containerEl, url, headers) {
        if (typeof window.XLSX === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const res = await fetch(url, { headers, credentials: 'include' });
        const arrayBuffer = await res.arrayBuffer();
        const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const htmlTable = window.XLSX.utils.sheet_to_html(sheet);

        containerEl.innerHTML = `
            <div style="width: 100%; max-height: 55vh; overflow: auto; background: var(--surface); border-radius: 8px; border: 1px solid var(--surface-border); padding: 6px;">
                <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 6px; font-weight: 700;">Sheet: ${firstSheetName}</div>
                <div class="table-container" style="font-size: 0.75rem;">
                    ${htmlTable}
                </div>
            </div>
        `;
    },

    async renderWordDocPreview(containerEl, url, headers, filename) {
        if (typeof window.mammoth === 'undefined') {
            try {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            } catch(e) {}
        }

        const res = await fetch(url, { headers, credentials: 'include' });
        const arrayBuffer = await res.arrayBuffer();

        if (window.mammoth && typeof window.mammoth.convertToHtml === 'function') {
            const result = await window.mammoth.convertToHtml({ arrayBuffer });
            containerEl.innerHTML = `
                <div style="width: 100%; max-height: 55vh; overflow-y: auto; background: var(--surface-card, #fff); color: var(--text, #000); border-radius: 8px; border: 1px solid var(--surface-border); padding: 16px; font-size: 0.85rem; line-height: 1.6;">
                    ${result.value || '<p style="color:var(--text-secondary);">No readable text found in document.</p>'}
                </div>
            `;
        } else {
            containerEl.innerHTML = `
                <div style="text-align: center; padding: 24px;">
                    <i class="fa-solid fa-file-word fa-3x" style="color: #3B82F6; margin-bottom: 12px;"></i>
                    <h4 style="font-size: 0.95rem;">${filename}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Word document ready. You can convert to PDF or save to Docholder storage.</p>
                </div>
            `;
        }
    }
};

window.DocholderStorage = DocholderStorage;
window.DocholderPreview = DocholderPreview;
window.openUniversalPreview = (fileOrUrl, originalName, mimeType, fileId) => DocholderPreview.open(fileOrUrl, originalName, mimeType, fileId);

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
    updateThemeIcons(localStorage.getItem('docholder_theme') || 'light');
});

// Docholder Settings Helper
function getDocholderSettings() {
    try {
        const raw = localStorage.getItem('docholder_settings');
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
        theme: 'light',
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

    const titleEl = document.getElementById('op-loader-title');
    if (titleEl) titleEl.textContent = title;

    const subtitleEl = document.getElementById('op-loader-subtitle');
    if (subtitleEl) subtitleEl.textContent = subtitle;

    const stagesList = document.getElementById('op-loader-stages');
    if (stagesList) {
        stagesList.innerHTML = stages.map((s, idx) => `
            <div class="op-stage-item ${idx === initialIndex ? 'active' : (idx < initialIndex ? 'completed' : '')}" id="op-stage-${idx}">
                <i class="fa-solid ${idx < initialIndex ? 'fa-circle-check' : (idx === initialIndex ? 'fa-circle-notch fa-spin' : 'fa-circle')} op-stage-icon"></i>
                <span>${s}</span>
            </div>
        `).join('');
    }

    const fillPercent = Math.min(100, Math.round(((initialIndex + 1) / stages.length) * 100));
    const fillEl = document.getElementById('op-loader-bar-fill');
    if (fillEl) fillEl.style.width = `${fillPercent}%`;

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

// ─── Cloud Backend Configuration ─────────────────────────────────────────────
// Single source of truth for the production backend URL.
// All API calls in Capacitor native builds (Android/iOS) resolve to this host.
const CLOUD_API_HOST = 'https://compressx-backend.onrender.com';
window.API_BASE_URL = window.API_BASE_URL || CLOUD_API_HOST;

// Resolves an API endpoint URL for any runtime context:
//   1. Custom host saved in Settings (overrides if valid external URL)
//   2. Web browser served by Express on PC (e.g., http://localhost:5000)
//   3. Capacitor native app / Android WebView / mobile (always uses CLOUD_API_HOST)
function resolveApiUrl(endpoint) {
    if (!endpoint || endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }

    const isNativeApp = (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.getPlatform() === 'android' || window.Capacitor.getPlatform() === 'ios')) ||
                        window.location.protocol === 'file:' ||
                        window.location.origin === 'https://localhost' ||
                        window.location.origin === 'capacitor://localhost' ||
                        window.location.origin === 'ionic://localhost' ||
                        (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '' || window.location.port === '80' || window.location.port === '443'));

    // 1. Custom host configured in Settings
    let customHost = localStorage.getItem('docholder_api_host');
    if (customHost && customHost.trim() !== '') {
        let host = customHost.trim();
        // If native app and user left/selected localhost, map to cloud backend
        if (isNativeApp && (host.includes('localhost') || host.includes('127.0.0.1'))) {
            return `${CLOUD_API_HOST}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        }
        return `${host.replace(/\/+$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    // 2. Mobile/Capacitor Native App Context → ALWAYS use Cloud Backend
    if (isNativeApp) {
        return `${CLOUD_API_HOST}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    // 3. Desktop browser served by Express (e.g. running on localhost:5000)
    if (window.location.origin && window.location.origin !== 'null' && !window.location.origin.includes('localhost')) {
        return `${window.location.origin}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    // Default to cloud backend
    return `${CLOUD_API_HOST}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

// Main API Fetch Wrapper
async function apiFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Accept': 'application/json'
    };

    const authToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
    if (authToken && (!options.headers || !options.headers['Authorization'])) {
        defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    options.headers = { ...defaultHeaders, ...options.headers };
    options.credentials = 'include'; // Send httpOnly JWT cookie

    try {
        const fullUrl = resolveApiUrl(endpoint);
        const response = await fetch(fullUrl, options);

        // 401 response handling (no forced redirect to login, return data/error gracefully)

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred.');
        }

        return data;
    } catch (err) {
        if (err.name === 'TypeError' || err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
            const activeHost = localStorage.getItem('docholder_api_host') || window.API_BASE_URL;
            console.error(`[Capacitor API Error] Could not reach backend server at ${activeHost}`, err);
            if (typeof showToast === 'function') {
                showToast(`Server connection failed (${activeHost}). Configure API Host in Settings.`, 'error', 4500);
            }
        }
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

        // Non-blocking background sync (only if token is present)
        const hasAuthToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
        if (hasAuthToken) {
            apiFetch('/api/auth/me').then(res => {
                if (res && res.user) {
                    applyUserToUI(res.user);
                    try { sessionStorage.setItem('docholder_cached_user', JSON.stringify(res.user)); } catch(e) {}
                }
            }).catch(() => {});
        }
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    initMobileAppEnvironment();
    initPullToRefresh();
});

/**
 * Docholder Mobile Pull-To-Refresh Feature
 * Enables smooth touch & pointer pull-down gestures from the top header to refresh page state
 */
function initPullToRefresh() {
    if (document.getElementById('ptr-indicator-box')) return;

    const scrollContainer = document.querySelector('.app-body') || document.body;
    if (!scrollContainer) return;

    const ptrBox = document.createElement('div');
    ptrBox.id = 'ptr-indicator-box';
    ptrBox.className = 'ptr-indicator';
    ptrBox.style.cssText = `
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%) translateY(-60px);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, rgba(0,240,255,0.3));
        border-radius: 30px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
        font-family: var(--font-hud, monospace);
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--cyan-neon, #00f0ff);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease, transform 0.15s ease;
    `;
    ptrBox.innerHTML = `
        <i id="ptr-icon" class="fa-solid fa-rotate-right" style="font-size: 0.9rem; transition: transform 0.1s ease;"></i>
        <span id="ptr-text">Pull to refresh</span>
    `;

    const shell = document.querySelector('.mobile-app-shell') || document.body;
    shell.appendChild(ptrBox);

    const ptrIcon = ptrBox.querySelector('#ptr-icon');
    const ptrText = ptrBox.querySelector('#ptr-text');

    let startY = 0;
    let pullDistance = 0;
    let isPulling = false;
    let isRefreshing = false;
    const REFRESH_THRESHOLD = 75;

    function onTouchStart(e) {
        if (isRefreshing) return;
        const pageY = e.touches ? e.touches[0].pageY : e.pageY;
        if (scrollContainer.scrollTop <= 0) {
            startY = pageY;
            isPulling = true;
        }
    }

    function onTouchMove(e) {
        if (!isPulling || isRefreshing) return;
        const pageY = e.touches ? e.touches[0].pageY : e.pageY;
        const diff = pageY - startY;

        if (diff > 0 && scrollContainer.scrollTop <= 0) {
            pullDistance = Math.min(diff * 0.45, 110);
            
            if (pullDistance > 10) {
                ptrBox.style.opacity = Math.min(pullDistance / REFRESH_THRESHOLD, 1);
                ptrBox.style.transform = `translateX(-50%) translateY(${pullDistance - 50}px)`;

                const rotation = Math.min(pullDistance * 4.5, 360);
                ptrIcon.style.transform = `rotate(${rotation}deg)`;

                if (pullDistance >= REFRESH_THRESHOLD) {
                    ptrText.textContent = 'Release to refresh';
                    ptrBox.style.borderColor = 'var(--emerald-neon, #00ff9d)';
                    ptrIcon.style.color = 'var(--emerald-neon, #00ff9d)';
                } else {
                    ptrText.textContent = 'Pull to refresh';
                    ptrBox.style.borderColor = 'var(--cyan-neon, #00f0ff)';
                    ptrIcon.style.color = 'var(--cyan-neon, #00f0ff)';
                }

                if (e.cancelable && e.touches) {
                    e.preventDefault();
                }
            }
        } else {
            isPulling = false;
            resetPtr();
        }
    }

    function onTouchEnd() {
        if (!isPulling || isRefreshing) return;
        isPulling = false;

        if (pullDistance >= REFRESH_THRESHOLD) {
            triggerRefresh();
        } else {
            resetPtr();
        }
    }

    async function triggerRefresh() {
        isRefreshing = true;
        ptrBox.style.opacity = '1';
        ptrBox.style.transform = 'translateX(-50%) translateY(20px)';
        ptrText.textContent = 'Syncing client workspace...';
        ptrIcon.className = 'fa-solid fa-rotate-right fa-spin';
        ptrIcon.style.color = 'var(--cyan-neon, #00f0ff)';
        ptrBox.style.borderColor = 'var(--cyan-neon, #00f0ff)';

        try {
            const tasks = [];
            if (typeof window.refreshWorkspaceData === 'function') {
                tasks.push(window.refreshWorkspaceData());
            }
            if (typeof window.loadDashboardStats === 'function') {
                tasks.push(window.loadDashboardStats());
            }
            if (typeof window.loadRecentFiles === 'function') {
                tasks.push(window.loadRecentFiles());
            }
            if (typeof window.loadTransformationHistory === 'function') {
                tasks.push(window.loadTransformationHistory());
            }
            if (typeof window.loadHistory === 'function') {
                tasks.push(window.loadHistory());
            }
            if (typeof window.loadFiles === 'function') {
                tasks.push(window.loadFiles());
            }

            if (tasks.length > 0) {
                await Promise.allSettled(tasks);
            }

            if (typeof initMobileAppEnvironment === 'function') {
                await initMobileAppEnvironment();
            }

            await new Promise(r => setTimeout(r, 400));

            ptrText.textContent = 'Workspace Synced!';
            ptrIcon.className = 'fa-solid fa-circle-check';
            ptrIcon.style.color = 'var(--emerald-neon, #00ff9d)';
            ptrBox.style.borderColor = 'var(--emerald-neon, #00ff9d)';

            if (typeof showToast === 'function') {
                showToast('Client workspace state refreshed!', 'success', 2200);
            }
        } catch(err) {
            if (typeof showToast === 'function') {
                showToast('Refreshed local workspace view', 'info', 2000);
            }
        } finally {
            setTimeout(() => {
                resetPtr();
                isRefreshing = false;
            }, 500);
        }
    }

    function resetPtr() {
        pullDistance = 0;
        ptrBox.style.opacity = '0';
        ptrBox.style.transform = 'translateX(-50%) translateY(-60px)';
        if (ptrIcon) {
            ptrIcon.className = 'fa-solid fa-rotate-right';
            ptrIcon.style.transform = 'rotate(0deg)';
        }
    }

    scrollContainer.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollContainer.addEventListener('touchend', onTouchEnd, { passive: true });

    scrollContainer.addEventListener('mousedown', (e) => {
        if (e.button === 0 && scrollContainer.scrollTop <= 0) {
            onTouchStart(e);
            const onMouseMove = (me) => onTouchMove(me);
            const onMouseUp = () => {
                onTouchEnd();
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
    });
}

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

/**
 * Universal Docholder Client API Object
 */
window.DocholderAPI = {
    apiFetch,
    getUsage: () => apiFetch('/api/files/usage'),
    registerPushToken: (deviceToken, platform) => apiFetch('/api/files/push-token', { method: 'POST', body: { deviceToken, platform } }),
    aiDetector: (formDataOrText) => {
        if (typeof formDataOrText === 'string') {
            return apiFetch('/api/files/ai-detector', { method: 'POST', body: { text: formDataOrText } });
        }
        return apiFetch('/api/files/ai-detector', { method: 'POST', body: formDataOrText });
    },
    humanize: (payload) => apiFetch('/api/files/humanize', { method: 'POST', body: payload }),
    understand: (formData) => apiFetch('/api/files/understand', { method: 'POST', body: formData }),
    chat: (payload) => apiFetch('/api/files/chat', { method: 'POST', body: payload }),
    crossIntelligence: (payload) => apiFetch('/api/files/cross-intelligence', { method: 'POST', body: payload }),
    factCheck: (formDataOrText) => {
        if (typeof formDataOrText === 'string') {
            return apiFetch('/api/files/fact-check', { method: 'POST', body: { text: formDataOrText } });
        }
        return apiFetch('/api/files/fact-check', { method: 'POST', body: formDataOrText });
    },
    diff: (formData) => apiFetch('/api/files/diff', { method: 'POST', body: formData }),
    dna: (formData) => apiFetch('/api/files/dna', { method: 'POST', body: formData }),
    health: (formData) => apiFetch('/api/files/health', { method: 'POST', body: formData }),
    fixEverything: (formData) => apiFetch('/api/files/fix-everything', { method: 'POST', body: formData }),
    goalOptimize: (formData) => apiFetch('/api/files/goal-optimize', { method: 'POST', body: formData }),
    smartPackage: (formData) => apiFetch('/api/files/smart-package', { method: 'POST', body: formData }),
    suggestName: (formData) => apiFetch('/api/files/suggest-name', { method: 'POST', body: formData }),
    classify: (formData) => apiFetch('/api/files/classify', { method: 'POST', body: formData }),
    privacyScan: (formData) => apiFetch('/api/files/privacy-scan', { method: 'POST', body: formData }),
    redactPii: (formData) => apiFetch('/api/files/redact-pii', { method: 'POST', body: formData }),
    translate: (formData) => apiFetch('/api/files/translate', { method: 'POST', body: formData }),
    meetingIntelligence: (payload) => apiFetch('/api/media/meeting-intelligence', { method: 'POST', body: payload }),
    videoIntelligence: (payload) => apiFetch('/api/media/video-intelligence', { method: 'POST', body: payload }),
    subtitles: (payload) => apiFetch('/api/media/subtitles', { method: 'POST', body: payload }),
    spreadsheetIntelligence: (formData) => apiFetch('/api/files/spreadsheet-intelligence', { method: 'POST', body: formData }),
    generateCharts: (formData) => apiFetch('/api/files/generate-charts', { method: 'POST', body: formData }),
    shareLink: (payload) => apiFetch('/api/files/share-link', { method: 'POST', body: payload }),
    vault: (payload) => apiFetch('/api/files/vault', { method: 'POST', body: payload }),
    buildWorkflow: (query) => apiFetch('/api/pipeline/builder', { method: 'POST', body: { query } }),
    getRecipes: () => apiFetch('/api/pipeline/recipes'),
    imageIntelligence: (payload) => apiFetch('/api/image/analyze', { method: 'POST', body: payload }),
    documentScan: (payload) => apiFetch('/api/image/document-scan', { method: 'POST', body: payload })
};

// Real-time live status bar clock updater
(function initStatusBarClock() {
    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formatted = `${hours % 12 || 12}:${minutes}`;
        document.querySelectorAll('.status-bar-time').forEach(el => {
            el.textContent = formatted;
        });
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updateClock);
        } else {
            updateClock();
        }
        setInterval(updateClock, 10000);
    }
})();

