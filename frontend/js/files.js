// Docholder Universal My Files Storage & Management Logic

let currentFilesList = [];
let selectedFileIds = new Set();
let activeEditFileId = null;
let activeConvertFileId = null;
let activeRenameFileId = null;
let activeWatermarkFileId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const filesTableBody = document.getElementById('files-table-body');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const fileCountSpan = document.getElementById('files-total-count');

    let currentCategory = 'all';
    let currentSearch = '';
    let currentSort = 'date';

    // 0. Check URL query params for category
    const urlParams = new URLSearchParams(window.location.search);
    const initCat = urlParams.get('category') || urlParams.get('cat');
    if (initCat) {
        currentCategory = initCat;
        document.querySelectorAll('.chip[data-category]').forEach(c => {
            c.classList.toggle('active', c.getAttribute('data-category') === initCat);
        });
    }

    // 1. Setup Filter Chips
    document.querySelectorAll('.chip[data-category]').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.chip[data-category]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.getAttribute('data-category');
            loadFiles();
        };
    });

    // Clear Downloaded History Button
    const btnClearDl = document.getElementById('btn-clear-downloaded');
    if (btnClearDl) {
        btnClearDl.onclick = () => {
            DocholderStorage.clearDownloadedFiles();
            showToast('Downloaded files list cleared.', 'info');
            loadFiles();
        };
    }

    // Live update when new files are saved to docholder folder
    window.addEventListener('docholder:file-downloaded', () => {
        if (currentCategory === 'downloaded' || currentCategory === 'recent') {
            loadFiles();
        }
    });

    // 2. Setup Live Search with Debounce
    if (searchInput) {
        let debounceTimer;
        searchInput.oninput = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearch = searchInput.value.trim();
                loadFiles();
            }, 250);
        };
    }

    // 3. Setup Sort Select
    if (sortSelect) {
        sortSelect.onchange = () => {
            currentSort = sortSelect.value;
            loadFiles();
        };
    }

    // 4. Batch Actions Setup
    const selectAllCheckbox = document.getElementById('select-all-files-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = () => {
            if (selectAllCheckbox.checked) {
                currentFilesList.forEach(f => selectedFileIds.add(f.id));
            } else {
                selectedFileIds.clear();
            }
            updateBatchUI();
        };
    }

    const btnBatchZip = document.getElementById('btn-batch-download-zip');
    if (btnBatchZip) {
        btnBatchZip.onclick = async () => {
            if (selectedFileIds.size === 0) return showToast('Please select at least 1 file.', 'warning');
            btnBatchZip.disabled = true;
            btnBatchZip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating ZIP...';
            try {
                const res = await apiFetch('/api/files/download-zip', {
                    method: 'POST',
                    body: { fileIds: Array.from(selectedFileIds) }
                });
                showToast('ZIP archive created!', 'success');
                if (res.downloadUrl) {
                    await DocholderStorage.saveFileLocally(res.downloadUrl, 'selected_files.zip');
                }
            } catch(e) {
                showToast(e.message || 'ZIP creation failed', 'error');
            } finally {
                btnBatchZip.disabled = false;
                btnBatchZip.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Download ZIP';
            }
        };
    }

    const btnBatchDelete = document.getElementById('btn-batch-delete');
    if (btnBatchDelete) {
        btnBatchDelete.onclick = async () => {
            if (selectedFileIds.size === 0) return showToast('Please select files to delete.', 'warning');
            
            showOperationLoader({
                title: 'Deleting Files',
                subtitle: `Removing ${selectedFileIds.size} files...`,
                stages: ['Purging file records...', 'Cleaning storage buffers...']
            });

            for (const fId of selectedFileIds) {
                try { await apiFetch(`/api/files/${fId}`, { method: 'DELETE' }); } catch(e) {}
            }
            hideOperationLoader();
            showToast('Selected files deleted successfully.', 'success');
            selectedFileIds.clear();
            await loadFiles();
        };
    }

    // Initial Load
    await loadFiles();

    async function loadFiles() {
        if (!filesTableBody) return;
        try {
            const queryParams = new URLSearchParams({
                category: currentCategory,
                sort: currentSort,
                q: currentSearch
            });

            let files = [];

            // If viewing Downloaded Docholder Files
            if (currentCategory === 'downloaded') {
                files = DocholderStorage.getDownloadedFiles();
                if (currentSearch) {
                    const qLower = currentSearch.toLowerCase();
                    files = files.filter(f => (f.original_name || f.name || '').toLowerCase().includes(qLower));
                }
            } else {
                const res = await apiFetch(`/api/files?${queryParams.toString()}`);
                files = res.files || [];

                if (currentCategory === 'favorites') {
                    const favIds = DocholderStorage.getFavorites();
                    files = files.filter(f => favIds.has(String(f.id)) || favIds.has(Number(f.id)));
                } else if (currentCategory === 'recent') {
                    const recentList = DocholderStorage.getRecentFiles();
                    const recentIds = recentList.map(r => Number(r.id));
                    files = files.filter(f => recentIds.includes(Number(f.id)));
                } else if (currentCategory === 'vault') {
                    const vaultData = JSON.parse(localStorage.getItem('docholder_vault_files') || '[]');
                    const vaultIds = vaultData.map(v => Number(v.fileId));
                    files = files.filter(f => vaultIds.includes(Number(f.id)));
                }
            }

            const vaultBanner = document.getElementById('vault-banner');
            if (vaultBanner) {
                vaultBanner.classList.toggle('hidden', currentCategory !== 'vault');
            }

            const downloadedBanner = document.getElementById('downloaded-banner');
            if (downloadedBanner) {
                downloadedBanner.classList.toggle('hidden', currentCategory !== 'downloaded');
            }

            currentFilesList = files;

            if (fileCountSpan) fileCountSpan.textContent = `${currentFilesList.length} file${currentFilesList.length !== 1 ? 's' : ''}`;

            filesTableBody.innerHTML = '';
            if (currentFilesList.length === 0) {
                const emptyMsg = currentCategory === 'downloaded' 
                    ? 'No downloaded files found in your Docholder folder yet. Convert or download files to save them directly to your phone storage.'
                    : 'Your workspace is empty or matches no filters.';
                filesTableBody.innerHTML = `<tr><td colspan="4" class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-folder-open"></i></div><div class="empty-state-title">No documents found</div><div class="empty-state-desc">${emptyMsg}</div><a href="upload.html" class="btn btn-primary btn-sm"><i class="fa-solid fa-cloud-arrow-up"></i> Upload Your First File</a></td></tr>`;
                updateBatchUI();
                return;
            }

            currentFilesList.forEach(f => {
                const tr = document.createElement('tr');
                const iconMap = {
                    image: 'fa-solid fa-file-image',
                    video: 'fa-solid fa-file-video',
                    audio: 'fa-solid fa-file-audio',
                    doc: 'fa-solid fa-file-word',
                    archive: 'fa-solid fa-file-zipper',
                    text: 'fa-solid fa-file-lines'
                };
                const colorMap = {
                    image: '#8B5CF6',
                    video: '#EC4899',
                    audio: '#10B981',
                    doc: '#EF4444',
                    archive: '#F59E0B',
                    text: '#0EA5E9'
                };

                const fileType = f.file_type || f.type || 'doc';
                const fileName = f.original_name || f.name || 'document';
                const fileSize = f.file_size || f.size || 0;
                const iconClass = iconMap[fileType] || 'fa-solid fa-file';
                const color = colorMap[fileType] || '#64748B';
                const isSelected = selectedFileIds.has(f.id);

                // Determine studio route
                let studioUrl = `convert.html?fileId=${f.id}`;
                if (fileType === 'image') studioUrl = `image-tools.html?fileId=${f.id}`;
                else if (fileType === 'video') studioUrl = `video-tools.html?fileId=${f.id}`;
                else if (fileType === 'audio') studioUrl = `audio-tools.html?fileId=${f.id}`;
                else if (fileType === 'doc') studioUrl = `document-tools.html?fileId=${f.id}`;

                const isFav = DocholderStorage.isFavorite(f.id);
                const dlUrl = f.downloadUrl || `/api/files/${f.id}/download`;

                tr.innerHTML = `
                    <td style="width: 32px; vertical-align: middle; padding: 12px 6px;">
                        <input type="checkbox" class="file-row-checkbox" value="${f.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 22px; height: 22px; accent-color: var(--primary); touch-action: manipulation;">
                    </td>
                    <td style="padding: 10px 8px;">
                        <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="openPreviewModalFromId('${f.id}')">
                            <i class="${iconClass}" style="color: ${color}; font-size: 1.25rem; min-width: 22px; text-align: center;"></i>
                            <div style="min-width: 0;">
                                <strong style="font-size: 0.88rem; color: var(--text); display: block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(fileName)}</strong>
                                <span style="font-size: 0.72rem; color: var(--text-secondary);">${f.created_at ? new Date(f.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Local'} ${currentCategory === 'downloaded' ? '• <span style="color:#10B981;">in docholder/</span>' : ''}</span>
                            </div>
                        </div>
                    </td>
                    <td style="font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; padding: 10px 8px;">${formatBytes(fileSize)}</td>
                    <td style="text-align: right; white-space: nowrap; padding: 10px 6px;">
                        <div class="file-row-actions" style="display: inline-flex; gap: 5px; flex-wrap: nowrap; justify-content: flex-end; align-items: center;">
                            <button class="icon-btn row-action-btn fav-btn" data-id="${f.id}" title="Toggle Star" style="color: ${isFav ? '#F59E0B' : 'var(--text-muted)'};"><i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i></button>
                            <button class="icon-btn row-action-btn prop-btn" data-id="${f.id}" title="Properties"><i class="fa-solid fa-circle-info"></i></button>
                            <button class="icon-btn row-action-btn preview-btn" data-id="${f.id}" title="In-App Preview"><i class="fa-solid fa-eye"></i></button>
                            <a href="${studioUrl}" class="icon-btn row-action-btn" title="Open in Studio" style="color: var(--primary); text-decoration:none;"><i class="fa-solid fa-wand-magic-sparkles"></i></a>
                            <button class="icon-btn row-action-btn local-dl-btn" data-url="${dlUrl}" data-name="${escapeAttr(fileName)}" data-id="${f.id}" title="Save to Docholder folder"><i class="fa-solid fa-download"></i></button>
                            <button class="icon-btn row-action-btn delete-btn" data-id="${f.id}" data-name="${escapeAttr(fileName)}" data-size="${fileSize}" title="Delete" style="color: var(--danger);"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                `;
                filesTableBody.appendChild(tr);
            });

            attachRowActionListeners();
            updateBatchUI();
        } catch(e) {
            console.warn('Error loading files list:', e);
        }
    }

    function attachRowActionListeners() {
        // Row Checkboxes
        document.querySelectorAll('.file-row-checkbox').forEach(cb => {
            cb.onchange = (e) => {
                const id = e.target.value;
                if (e.target.checked) selectedFileIds.add(id);
                else selectedFileIds.delete(id);
                updateBatchUI();
            };
        });

        // In-App Preview (Uses DocholderPreview)
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const file = currentFilesList.find(f => String(f.id) === String(id));
                if (file) {
                    if (window.DocholderPreview) {
                        window.DocholderPreview.open(file);
                    } else {
                        openPreviewModal(file);
                    }
                }
            };
        });

        // Favorites toggle
        document.querySelectorAll('.fav-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const nextFav = DocholderStorage.toggleFavorite(id);
                showToast(nextFav ? 'Added to Starred files' : 'Removed from Starred', 'info', 1200);
                loadFiles();
            };
        });

        // Properties
        document.querySelectorAll('.prop-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const file = currentFilesList.find(f => String(f.id) === String(id));
                if (file) openPropertiesModal(file);
            };
        });

        // Local Save into Docholder folder
        document.querySelectorAll('.local-dl-btn').forEach(btn => {
            btn.onclick = async () => {
                const url = btn.getAttribute('data-url');
                const name = btn.getAttribute('data-name');
                const id = btn.getAttribute('data-id');
                const file = currentFilesList.find(f => String(f.id) === String(id));
                if (file) DocholderStorage.addRecentFile(file);
                await DocholderStorage.saveFileLocally(url, name);
            };
        });

        // Delete with Confirmation
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const size = formatBytes(parseInt(btn.getAttribute('data-size') || '0', 10));
                confirmDeleteFile(id, name, size);
            };
        });
    }

    function updateBatchUI() {
        const countLabel = document.getElementById('selected-files-count-label');
        if (countLabel) countLabel.textContent = `${selectedFileIds.size} selected`;

        const selectAllCheckbox = document.getElementById('select-all-files-checkbox');
        if (selectAllCheckbox && currentFilesList.length > 0) {
            selectAllCheckbox.checked = selectedFileIds.size === currentFilesList.length;
        }

        document.querySelectorAll('.file-row-checkbox').forEach(cb => {
            cb.checked = selectedFileIds.has(parseInt(cb.value, 10));
        });
    }

    // Modal Close Buttons
    document.getElementById('close-preview-btn')?.addEventListener('click', () => document.getElementById('preview-modal')?.classList.add('hidden'));
    document.getElementById('close-rename-btn')?.addEventListener('click', () => document.getElementById('rename-modal')?.classList.add('hidden'));
    document.getElementById('cancel-rename-btn')?.addEventListener('click', () => document.getElementById('rename-modal')?.classList.add('hidden'));
    document.getElementById('close-edit-btn')?.addEventListener('click', () => document.getElementById('edit-modal')?.classList.add('hidden'));
});

function openPreviewModalFromId(fileId) {
    const file = currentFilesList.find(f => String(f.id) === String(fileId));
    if (file) {
        if (window.DocholderPreview) {
            window.DocholderPreview.open(file);
        } else {
            openPreviewModal(file);
        }
    }
}

// Universal Media Preview Modal Logic
async function openPreviewModal(file) {
    if (window.DocholderPreview) {
        return window.DocholderPreview.open(file);
    }
    const modal = document.getElementById('preview-modal');
    const title = document.getElementById('preview-title');
    const body = document.getElementById('preview-body');
    if (!modal || !body) return;

    title.textContent = `${file.original_name} (${formatBytes(file.file_size)})`;
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading preview...</p></div>';
    modal.classList.remove('hidden');

    const downloadUrl = (typeof resolveApiUrl === 'function')
        ? resolveApiUrl(`/api/files/${file.id}/download?inline=true`)
        : `/api/files/${file.id}/download?inline=true`;
    const ext = file.original_name.split('.').pop().toLowerCase();

    if (file.mime_type.startsWith('image/')) {
        body.innerHTML = `
            <div class="media-preview-container" style="background:#111;">
                <img src="${downloadUrl}" style="max-width:100%; max-height:350px; object-fit:contain;" alt="${file.original_name}">
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <a href="image-tools.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-wand-magic-sparkles"></i> Open in Image Studio</a>
                <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" title="Download"><i class="fa-solid fa-download"></i></button>
            </div>
        `;
    } else if (file.mime_type.startsWith('video/')) {
        body.innerHTML = `
            <div class="media-preview-container">
                <video controls autoplay muted preload="metadata" style="width:100%; max-height:280px;">
                    <source src="${downloadUrl}" type="${file.mime_type}">
                    Your browser does not support HTML5 video playback.
                </video>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <a href="video-tools.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-wand-magic-sparkles"></i> Open in Video Studio</a>
                <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" title="Download"><i class="fa-solid fa-download"></i></button>
            </div>
        `;
    } else if (file.mime_type.startsWith('audio/')) {
        body.innerHTML = `
            <div class="media-preview-container" style="background:var(--surface-card); padding:20px 10px;">
                <audio controls autoplay style="width:100%;">
                    <source src="${downloadUrl}" type="${file.mime_type}">
                    Your browser does not support audio playback.
                </audio>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <a href="audio-tools.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-wand-magic-sparkles"></i> Open in Audio Studio</a>
                <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" title="Download"><i class="fa-solid fa-download"></i></button>
            </div>
        `;
    } else if (file.mime_type.includes('pdf') || ext === 'pdf') {
        body.innerHTML = `
            <iframe src="${downloadUrl}" style="width:100%; height:380px; border:none; border-radius:8px;"></iframe>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <a href="document-tools.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-file-pdf"></i> Open in Document Studio</a>
                <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" title="Download"><i class="fa-solid fa-download"></i></button>
            </div>
        `;
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        try {
            const resp = await fetch(downloadUrl);
            const arrayBuffer = await resp.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const htmlTable = XLSX.utils.sheet_to_html(sheet);
            body.innerHTML = `
                <div style="overflow-x:auto; max-height:300px; padding:6px; background:var(--surface); border:1px solid var(--surface-border); border-radius:6px;">
                    ${htmlTable}
                </div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <a href="convert.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-rotate"></i> Convert Table</a>
                    <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" title="Download"><i class="fa-solid fa-download"></i></button>
                </div>
            `;
        } catch(e) {
            body.innerHTML = `<p style="color:var(--danger);">Error rendering spreadsheet: ${e.message}</p>`;
        }
    } else if (file.mime_type.startsWith('text/') || ['json', 'js', 'html', 'css', 'py', 'md', 'txt'].includes(ext)) {
        try {
            const resp = await fetch(downloadUrl);
            const text = await resp.text();
            const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            body.innerHTML = `
                <pre style="font-family:monospace; white-space:pre-wrap; padding:12px; background:var(--surface-hover); border-radius:6px; font-size:0.8rem; max-height:280px; overflow-y:auto;">${escaped}</pre>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <a href="convert.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-rotate"></i> Convert to PDF / Word</a>
                    <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" title="Download"><i class="fa-solid fa-download"></i></button>
                </div>
            `;
        } catch(e) {
            body.innerHTML = `<p style="color:var(--danger);">Error loading text: ${e.message}</p>`;
        }
    } else {
        body.innerHTML = `
            <div style="text-align:center; padding:30px 10px;">
                <i class="fa-solid fa-file-circle-check fa-3x" style="color:var(--primary); margin-bottom:12px;"></i>
                <h4 style="font-size:0.9rem;">${file.original_name}</h4>
                <p style="color:var(--text-secondary); font-size:0.78rem; margin-top:4px;">Direct inline preview not supported for this binary format.</p>
                <div style="display:flex; gap:8px; margin-top:14px;">
                    <a href="convert.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-rotate"></i> Convert File</a>
                    <button onclick="DocholderStorage.saveFileLocally('${downloadUrl}', '${escapeAttr(file.original_name)}')" class="btn btn-secondary btn-sm" style="flex:1;" title="Download"><i class="fa-solid fa-download"></i> Download</button>
                </div>
            </div>
        `;
    }
}

let pendingDeleteId = null;

function confirmDeleteFile(id, name, size) {
    pendingDeleteId = id;
    const modal = document.getElementById('delete-confirm-modal');
    const msg = document.getElementById('delete-confirm-msg');
    if (modal && msg) {
        msg.innerHTML = `Are you sure you want to permanently delete <strong>${name}</strong> (${size})? This action cannot be undone.`;
        modal.classList.remove('hidden');
    }
}

document.getElementById('close-delete-confirm-btn')?.addEventListener('click', () => {
    document.getElementById('delete-confirm-modal')?.classList.add('hidden');
    pendingDeleteId = null;
});

document.getElementById('cancel-delete-confirm-btn')?.addEventListener('click', () => {
    document.getElementById('delete-confirm-modal')?.classList.add('hidden');
    pendingDeleteId = null;
});

document.getElementById('exec-delete-confirm-btn')?.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const modal = document.getElementById('delete-confirm-modal');
    try {
        if (currentCategory === 'downloaded' || String(pendingDeleteId).startsWith('dl_')) {
            DocholderStorage.removeDownloadedFile(pendingDeleteId);
            showToast('Downloaded file removed.', 'success');
        } else {
            await apiFetch(`/api/files/${pendingDeleteId}`, { method: 'DELETE' });
            showToast('File permanently deleted.', 'success');
        }
        if (modal) modal.classList.add('hidden');
        selectedFileIds.delete(pendingDeleteId);
        selectedFileIds.delete(parseInt(pendingDeleteId, 10));
        pendingDeleteId = null;
        await loadFiles();
    } catch(e) {
        showToast(e.message || 'Delete failed', 'error');
    }
});

let currentPropertyFile = null;

function openPropertiesModal(file) {
    currentPropertyFile = file;
    const modal = document.getElementById('properties-modal');
    const body = document.getElementById('properties-body');
    if (!modal || !body) return;

    const created = new Date(file.created_at).toLocaleString();
    const ext = (file.original_name || '').split('.').pop().toUpperCase();

    body.innerHTML = `
        <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-xs); border: 1px solid var(--surface-border);">
            <div style="color: var(--text-secondary); font-size: 0.72rem;">File Name:</div>
            <strong style="font-family: var(--font-mono); color: var(--text); word-break: break-all;">${file.original_name}</strong>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--surface-border);">
                <div style="color: var(--text-secondary); font-size: 0.72rem;">Size:</div>
                <strong style="color: var(--cyan-neon);">${formatBytes(file.file_size)}</strong>
            </div>
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--surface-border);">
                <div style="color: var(--text-secondary); font-size: 0.72rem;">Format:</div>
                <strong>${ext}</strong>
            </div>
        </div>
        <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-xs); border: 1px solid var(--surface-border);">
            <div style="color: var(--text-secondary); font-size: 0.72rem;">MIME Type:</div>
            <span style="font-family: var(--font-mono);">${file.mime_type}</span>
        </div>
        <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-xs); border: 1px solid var(--surface-border);">
            <div style="color: var(--text-secondary); font-size: 0.72rem;">Created:</div>
            <span>${created}</span>
        </div>
    `;

    modal.classList.remove('hidden');
}

document.getElementById('close-properties-btn')?.addEventListener('click', () => {
    document.getElementById('properties-modal')?.classList.add('hidden');
});

document.getElementById('btn-prop-share')?.addEventListener('click', async () => {
    if (!currentPropertyFile) return;
    const downloadUrl = `/api/files/${currentPropertyFile.id}/download`;
    await DocholderStorage.shareFile(downloadUrl, currentPropertyFile.original_name, currentPropertyFile.mime_type);
});

document.getElementById('btn-prop-local-save')?.addEventListener('click', async () => {
    if (!currentPropertyFile) return;
    DocholderStorage.saveFileLocally(`/api/files/${currentPropertyFile.id}/download`, currentPropertyFile.original_name);
});

// ── Smart Share Link Logic ──────────────────────────────────────────
function openShareModal(fileId = null) {
    const modal = document.getElementById('share-link-modal');
    const select = document.getElementById('share-file-select');
    const resultBox = document.getElementById('share-result-box');
    if (!modal) return;

    if (select) {
        select.innerHTML = currentFilesList.map(f => `
            <option value="${f.id}" ${String(f.id) === String(fileId) ? 'selected' : ''}>${f.original_name} (${formatBytes(f.file_size)})</option>
        `).join('');
    }
    if (resultBox) resultBox.classList.add('hidden');
    modal.classList.remove('hidden');
}

document.getElementById('close-share-modal-btn')?.addEventListener('click', () => {
    document.getElementById('share-link-modal')?.classList.add('hidden');
});

document.getElementById('btn-generate-share-link')?.addEventListener('click', async () => {
    const fileId = document.getElementById('share-file-select')?.value;
    const hours = parseInt(document.getElementById('share-expiration-select')?.value || '24', 10);
    const password = document.getElementById('share-password-input')?.value || null;

    if (!fileId) return showToast('Please select a file to share.', 'warning');

    try {
        const res = await window.DocholderAPI.shareLink({ fileId, expirationHours: hours, password });
        const resultBox = document.getElementById('share-result-box');
        const urlInput = document.getElementById('share-generated-url');
        if (resultBox && urlInput) {
            resultBox.classList.remove('hidden');
            const shareUrl = res.shareUrl || `${window.location.origin}/share/${res.shareId || 'temp'}`;
            urlInput.value = shareUrl;
            showToast('Secure share link generated!', 'success');
        }
    } catch(err) {
        showToast(err.message || 'Failed to create share link.', 'error');
    }
});

document.getElementById('btn-copy-share-url')?.addEventListener('click', () => {
    const input = document.getElementById('share-generated-url');
    if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('Share link copied to clipboard! ✓', 'success');
    }
});

// ── Temporary File Vault Logic ───────────────────────────────────────
function openVaultModal(fileId = null) {
    const modal = document.getElementById('vault-modal');
    const select = document.getElementById('vault-file-select');
    if (!modal) return;

    if (select) {
        select.innerHTML = currentFilesList.map(f => `
            <option value="${f.id}" ${String(f.id) === String(fileId) ? 'selected' : ''}>${f.original_name} (${formatBytes(f.file_size)})</option>
        `).join('');
    }
    modal.classList.remove('hidden');
}

document.getElementById('btn-add-to-vault')?.addEventListener('click', () => {
    openVaultModal();
});

document.getElementById('close-vault-modal-btn')?.addEventListener('click', () => {
    document.getElementById('vault-modal')?.classList.add('hidden');
});

document.getElementById('btn-save-to-vault')?.addEventListener('click', async () => {
    const fileId = document.getElementById('vault-file-select')?.value;
    const retentionHours = parseInt(document.getElementById('vault-retention-select')?.value || '24', 10);

    if (!fileId) return showToast('Please select a file to vault.', 'warning');

    try {
        await window.DocholderAPI.vault({ fileId, retentionHours });
        const existing = JSON.parse(localStorage.getItem('docholder_vault_files') || '[]');
        if (!existing.some(v => String(v.fileId) === String(fileId))) {
            existing.push({ fileId: Number(fileId), addedAt: Date.now(), retentionHours });
            localStorage.setItem('docholder_vault_files', JSON.stringify(existing));
        }
        document.getElementById('vault-modal')?.classList.add('hidden');
        showToast(`Stored in self-destruct vault (${retentionHours}h retention)`, 'success');
        // Activate vault category chip if not already
        const vaultChip = document.getElementById('chip-vault');
        if (vaultChip) vaultChip.click();
    } catch(err) {
        showToast(err.message || 'Failed to store in vault.', 'error');
    }
});

// Check URL Params for deep actions
(function handleUrlActions() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'share') {
        setTimeout(() => openShareModal(params.get('fileId')), 400);
    } else if (params.get('vault') === 'true') {
        setTimeout(() => {
            const vaultChip = document.getElementById('chip-vault');
            if (vaultChip) vaultChip.click();
        }, 300);
    }
})();

