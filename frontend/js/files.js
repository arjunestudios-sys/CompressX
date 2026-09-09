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

    // 1. Setup Filter Chips
    document.querySelectorAll('.chip[data-category]').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.chip[data-category]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.getAttribute('data-category');
            loadFiles();
        };
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
                window.location.href = res.downloadUrl;
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

            const res = await apiFetch(`/api/files?${queryParams.toString()}`);
            let files = res.files || [];

            if (currentCategory === 'favorites') {
                const favIds = DocholderStorage.getFavorites();
                files = files.filter(f => favIds.includes(Number(f.id)));
            } else if (currentCategory === 'recent') {
                const recentList = DocholderStorage.getRecentFiles();
                const recentIds = recentList.map(r => Number(r.id));
                files = files.filter(f => recentIds.includes(Number(f.id)));
            }

            currentFilesList = files;

            if (fileCountSpan) fileCountSpan.textContent = `${currentFilesList.length} file${currentFilesList.length !== 1 ? 's' : ''}`;

            filesTableBody.innerHTML = '';
            if (currentFilesList.length === 0) {
                filesTableBody.innerHTML = `<tr><td colspan="4" class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-folder-open"></i></div><div class="empty-state-title">No documents found</div><div class="empty-state-desc">Your workspace is empty or matches no filters.</div><a href="upload.html" class="btn btn-primary btn-sm"><i class="fa-solid fa-cloud-arrow-up"></i> Upload Your First File</a></td></tr>`;
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

                const iconClass = iconMap[f.file_type] || 'fa-solid fa-file';
                const color = colorMap[f.file_type] || '#64748B';
                const isSelected = selectedFileIds.has(f.id);

                // Determine studio route
                let studioUrl = `convert.html?fileId=${f.id}`;
                if (f.file_type === 'image') studioUrl = `image-tools.html?fileId=${f.id}`;
                else if (f.file_type === 'video') studioUrl = `video-tools.html?fileId=${f.id}`;
                else if (f.file_type === 'audio') studioUrl = `audio-tools.html?fileId=${f.id}`;
                else if (f.file_type === 'doc') studioUrl = `document-tools.html?fileId=${f.id}`;

                const isFav = DocholderStorage.getFavorites().includes(Number(f.id));

                tr.innerHTML = `
                    <td style="width: 24px; vertical-align: middle;">
                        <input type="checkbox" class="file-row-checkbox" value="${f.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; accent-color: var(--primary);">
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="openPreviewModalFromId(${f.id})">
                            <i class="${iconClass}" style="color: ${color}; font-size: 1.1rem;"></i>
                            <div>
                                <strong style="font-size: 0.84rem; color: var(--text); display: block; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.original_name}</strong>
                                <span style="font-size: 0.7rem; color: var(--text-secondary);">${new Date(f.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </td>
                    <td style="font-size: 0.76rem; color: var(--text-secondary); white-space: nowrap;">${formatBytes(f.file_size)}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; gap: 4px; flex-wrap: nowrap; justify-content: flex-end;">
                            <button class="icon-btn fav-btn" data-id="${f.id}" title="Toggle Star" style="width:26px; height:26px; font-size:0.75rem; color: ${isFav ? '#F59E0B' : 'var(--text-muted)'};"><i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i></button>
                            <button class="icon-btn prop-btn" data-id="${f.id}" title="Properties" style="width:26px; height:26px; font-size:0.75rem;"><i class="fa-solid fa-circle-info"></i></button>
                            <button class="icon-btn preview-btn" data-id="${f.id}" title="Preview" style="width:26px; height:26px; font-size:0.75rem;"><i class="fa-solid fa-eye"></i></button>
                            <a href="${studioUrl}" class="icon-btn" title="Open in Studio" style="width:26px; height:26px; font-size:0.75rem; color: var(--primary); text-decoration:none; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-wand-magic-sparkles"></i></a>
                            <button class="icon-btn local-dl-btn" data-url="/api/files/${f.id}/download" data-name="${f.original_name}" data-id="${f.id}" title="Save Locally" style="width:26px; height:26px; font-size:0.75rem;"><i class="fa-solid fa-download"></i></button>
                            <button class="icon-btn delete-btn" data-id="${f.id}" data-name="${f.original_name}" data-size="${f.file_size}" title="Delete" style="width:26px; height:26px; font-size:0.75rem; color: var(--danger);"><i class="fa-solid fa-trash-can"></i></button>
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
                const id = parseInt(e.target.value, 10);
                if (e.target.checked) selectedFileIds.add(id);
                else selectedFileIds.delete(id);
                updateBatchUI();
            };
        });

        // Preview
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const file = currentFilesList.find(f => String(f.id) === String(id));
                if (file) openPreviewModal(file);
            };
        });

        // Favorites toggle
        document.querySelectorAll('.fav-btn').forEach(btn => {
            btn.onclick = () => {
                const id = Number(btn.getAttribute('data-id'));
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

        // Local Save
        document.querySelectorAll('.local-dl-btn').forEach(btn => {
            btn.onclick = async () => {
                const permitted = await requestDocholderPermission('storage', 'save files directly to your device');
                if (!permitted) return;
                const url = btn.getAttribute('data-url');
                const name = btn.getAttribute('data-name');
                const id = btn.getAttribute('data-id');
                const file = currentFilesList.find(f => String(f.id) === String(id));
                if (file) DocholderStorage.addRecentFile(file);
                DocholderStorage.saveFileLocally(url, name);
                showToast(`Saved "${name}" to device local storage`, 'success');
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
    document.getElementById('close-preview-btn')?.addEventListener('click', () => document.getElementById('preview-modal').classList.add('hidden'));
    document.getElementById('close-rename-btn')?.addEventListener('click', () => document.getElementById('rename-modal').classList.add('hidden'));
    document.getElementById('cancel-rename-btn')?.addEventListener('click', () => document.getElementById('rename-modal').classList.add('hidden'));
    document.getElementById('close-edit-btn')?.addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
});

function openPreviewModalFromId(fileId) {
    const file = currentFilesList.find(f => String(f.id) === String(fileId));
    if (file) openPreviewModal(file);
}

// Universal Media Preview Modal Logic
async function openPreviewModal(file) {
    const modal = document.getElementById('preview-modal');
    const title = document.getElementById('preview-title');
    const body = document.getElementById('preview-body');
    if (!modal || !body) return;

    title.textContent = `${file.original_name} (${formatBytes(file.file_size)})`;
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading preview...</p></div>';
    modal.classList.remove('hidden');

    const downloadUrl = `/api/files/${file.id}/download?inline=true`;
    const ext = file.original_name.split('.').pop().toLowerCase();

    if (file.mime_type.startsWith('image/')) {
        body.innerHTML = `
            <div class="media-preview-container" style="background:#111;">
                <img src="${downloadUrl}" style="max-width:100%; max-height:350px; object-fit:contain;" alt="${file.original_name}">
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <a href="image-tools.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-wand-magic-sparkles"></i> Open in Image Studio</a>
                <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i></a>
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
                <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i></a>
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
                <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i></a>
            </div>
        `;
    } else if (file.mime_type.includes('pdf') || ext === 'pdf') {
        body.innerHTML = `
            <iframe src="${downloadUrl}" style="width:100%; height:380px; border:none; border-radius:8px;"></iframe>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <a href="document-tools.html?fileId=${file.id}" class="btn btn-primary btn-sm" style="flex:1;"><i class="fa-solid fa-file-pdf"></i> Open in Document Studio</a>
                <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i></a>
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
                    <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i></a>
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
                    <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i></a>
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
                    <a href="${downloadUrl}" download="${file.original_name}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i> Download</a>
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
        await apiFetch(`/api/files/${pendingDeleteId}`, { method: 'DELETE' });
        showToast('File permanently deleted.', 'success');
        if (modal) modal.classList.add('hidden');
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
    const downloadUrl = (typeof resolveApiUrl === 'function') 
        ? resolveApiUrl(`/api/files/${currentPropertyFile.id}/download`)
        : `${window.location.origin}/api/files/${currentPropertyFile.id}/download`;
    if (navigator.share) {
        try {
            await navigator.share({
                title: currentPropertyFile.original_name,
                text: `Docholder Asset: ${currentPropertyFile.original_name} (${formatBytes(currentPropertyFile.file_size)})`,
                url: downloadUrl
            });
            showToast('Share dialog opened', 'success');
        } catch(e) {}
    } else {
        await navigator.clipboard.writeText(downloadUrl);
        showToast('Download link copied to clipboard!', 'success');
    }
});

document.getElementById('btn-prop-local-save')?.addEventListener('click', async () => {
    if (!currentPropertyFile) return;
    const permitted = await requestDocholderPermission('storage', 'save files to your device');
    if (!permitted) return;
    DocholderStorage.saveFileLocally(`/api/files/${currentPropertyFile.id}/download`, currentPropertyFile.original_name);
    DocholderStorage.addRecentFile(currentPropertyFile);
    showToast(`Saved "${currentPropertyFile.original_name}" to local storage`, 'success');
});

