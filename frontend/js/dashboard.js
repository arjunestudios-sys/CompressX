/**
 * Docholder Dashboard — Universal File Workspace Controller
 */

let activeWorkspaceFile = null;

document.addEventListener('DOMContentLoaded', () => {
    // Parallelized dashboard loading for ultra-fast response
    Promise.allSettled([
        loadDashboardStats(),
        loadRecentFiles(),
        loadTransformationHistory()
    ]);
    setupDropzone();
    setupModals();
});

async function loadDashboardStats() {
    try {
        const [userRes, filesRes, histRes] = await Promise.all([
            apiFetch('/api/auth/me').catch(() => null),
            apiFetch('/api/files').catch(() => null),
            apiFetch('/api/convert/history').catch(() => null)
        ]);

        if (userRes && userRes.user) {
            const user = userRes.user;
            const storageLimit = 524288000; // 500 MB default
            const used = user.storage_used || 0;
            const pct = Math.min(100, Math.round((used / storageLimit) * 100));

            const storageUsedEl = document.getElementById('stat-storage-used');
            if (storageUsedEl) storageUsedEl.textContent = `${formatBytes(used)} / ${formatBytes(storageLimit)}`;

            const barFill = document.getElementById('storage-bar-fill');
            if (barFill) barFill.style.width = `${pct}%`;
        }

        const countEl = document.getElementById('stat-total-files');
        if (countEl && filesRes && filesRes.files) countEl.textContent = filesRes.files.length;

        const transEl = document.getElementById('stat-transformed');
        if (transEl && histRes && histRes.history) transEl.textContent = histRes.history.length;
    } catch (err) {}
}

async function loadRecentFiles() {
    const list = document.getElementById('recent-files-list');
    if (!list) return;

    try {
        const data = await apiFetch('/api/files?sort=date');
        const files = (data.files || []).slice(0, 6);

        if (files.length === 0) {
            list.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 20px;">No files uploaded yet. Drop a file above to begin!</td></tr>';
            return;
        }

        const iconMap = {
            doc: 'fa-file-pdf',
            image: 'fa-file-image',
            video: 'fa-file-video',
            audio: 'fa-file-audio',
            archive: 'fa-file-zipper',
            text: 'fa-file-lines',
            other: 'fa-file'
        };

        const colorMap = {
            doc: '#EF4444',
            image: '#8B5CF6',
            video: '#EC4899',
            audio: '#10B981',
            archive: '#F59E0B',
            text: '#64748B',
            other: '#64748B'
        };

        list.innerHTML = files.map(f => {
            const icon = iconMap[f.file_type] || 'fa-file';
            const color = colorMap[f.file_type] || '#64748B';

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="selectAndInspectFile(${f.id})">
                            <i class="fa-solid ${icon}" style="color: ${color}; font-size: 1rem;"></i>
                            <span style="font-weight: 600; font-size: 0.82rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.original_name}</span>
                        </div>
                    </td>
                    <td style="font-size: 0.76rem; color: var(--text-secondary); white-space: nowrap;">${formatBytes(f.file_size)}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="openConvertModalForFile(${f.id}, '${f.original_name}')" style="padding: 2px 6px; font-size: 0.72rem;" title="Convert"><i class="fa-solid fa-rotate"></i></button>
                        <a href="/api/files/${f.id}/download" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.72rem;" title="Download"><i class="fa-solid fa-download"></i></a>
                    </td>
                </tr>
            `;
        }).join('');
    } catch(err) {
        list.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--danger); padding: 14px;">Failed to load files: ${err.message}</td></tr>`;
    }
}

async function loadTransformationHistory() {
    const list = document.getElementById('transformation-history-list');
    if (!list) return;

    try {
        const data = await apiFetch('/api/convert/history');
        const history = (data.history || []).slice(0, 4);

        if (history.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 14px; font-size: 0.82rem;">No transformations yet.</div>';
            return;
        }

        list.innerHTML = history.map(h => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--surface-hover); border-radius: var(--radius-xs); font-size: 0.78rem;">
                <div style="overflow: hidden;">
                    <div style="font-weight: 700; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.result_name || h.original_name}</div>
                    <span style="color: var(--text-secondary); font-size: 0.7rem;">${h.action_type} • ${formatBytes(h.result_size)}</span>
                </div>
                ${h.download_url ? `<a href="${h.download_url}" class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;"><i class="fa-solid fa-download"></i></a>` : ''}
            </div>
        `).join('');
    } catch(e) {}
}

function setupDropzone() {
    const dropzone = document.getElementById('smart-dropzone');
    const input = document.getElementById('smart-file-input');
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await handleUniversalUpload(e.target.files[0]);
        }
    });

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--surface-border)'; });
    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--surface-border)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleUniversalUpload(e.dataTransfer.files[0]);
        }
    });

    // Clear intent
    const clearBtn = document.getElementById('clear-intent-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('detected-intent-box').classList.add('hidden');
            activeWorkspaceFile = null;
        });
    }
}

async function handleUniversalUpload(fileObj) {
    const dropzone = document.getElementById('dashboard-dropzone');
    const tracker = typeof renderFileUploadTracker === 'function' ? renderFileUploadTracker(dropzone, fileObj) : null;

    try {
        if (tracker) tracker.update(25, 'Loading file... 25%', 'Est: ~1s');
        await new Promise(r => setTimeout(r, 80));

        if (tracker) tracker.update(60, 'Reading file contents... 60%', 'Est: ~1s');

        const res = await uploadFileWithProgress('/api/files/upload', fileObj, (p) => {
            if (tracker && p.percent) {
                const scaled = Math.min(88, Math.max(25, Math.round(p.percent * 0.88)));
                tracker.update(scaled, `Reading file contents... ${scaled}%`);
            }
        });

        if (tracker) tracker.update(95, 'Preparing document intelligence... 95%');
        await new Promise(r => setTimeout(r, 60));

        if (tracker) tracker.ready(fileObj.name);
        showToast(`Uploaded ${res.file.original_name} successfully!`, 'success');
        activeWorkspaceFile = res.file;
        DocholderStorage.addRecentFile(res.file);
        await Promise.allSettled([loadDashboardStats(), loadRecentFiles()]);

        displayDetectedFile(res.file, res.inspection);
    } catch(err) {
        if (tracker) tracker.error(err.message || 'Upload failed');
        showToast(err.message || 'Upload failed.', 'error');
    }
}

async function selectAndInspectFile(fileId) {
    try {
        const res = await apiFetch(`/api/files/${fileId}/inspect`);
        if (res && res.file) {
            activeWorkspaceFile = res.file;
            DocholderStorage.addRecentFile(res.file);
            displayDetectedFile(res.file, res.inspection);
            document.getElementById('detected-intent-box').scrollIntoView({ behavior: 'smooth' });
        }
    } catch(e) {}
}

function displayDetectedFile(file, inspection) {
    const box = document.getElementById('detected-intent-box');
    if (box && typeof renderHeavyFileInspector === 'function') {
        renderHeavyFileInspector(box, file, { mediaType: file.file_type });
    }
    if (!box) return;
    box.classList.remove('hidden');

    document.getElementById('intent-file-name').textContent = file.original_name;
    document.getElementById('intent-file-size').textContent = `${formatBytes(file.file_size)} • ${file.mime_type || file.file_type}`;

    const iconMap = {
        doc: 'fa-file-pdf',
        image: 'fa-file-image',
        video: 'fa-file-video',
        audio: 'fa-file-audio',
        archive: 'fa-file-zipper',
        text: 'fa-file-lines'
    };
    const iconEl = document.getElementById('intent-file-icon');
    if (iconEl) iconEl.className = `fa-solid ${iconMap[file.file_type] || 'fa-file'}`;

    // Render metadata chips (dimensions, duration, pages)
    const chipsContainer = document.getElementById('intent-meta-chips');
    if (chipsContainer && inspection && inspection.details) {
        const d = inspection.details;
        let chips = [];
        if (d.dimensions) chips.push(`<span class="badge" style="background:var(--surface);"><i class="fa-solid fa-expand"></i> ${d.dimensions}</span>`);
        if (d.durationFormatted) chips.push(`<span class="badge" style="background:var(--surface);"><i class="fa-solid fa-clock"></i> ${d.durationFormatted}</span>`);
        if (d.fps) chips.push(`<span class="badge" style="background:var(--surface);">${d.fps} FPS</span>`);
        if (d.pageCount) chips.push(`<span class="badge" style="background:var(--surface);"><i class="fa-solid fa-book-open"></i> ${d.pageCount} Pages</span>`);
        chipsContainer.innerHTML = chips.join('');
    }

    // Render 3-5 Recommended Action Pills
    const pillsContainer = document.getElementById('intent-action-pills');
    if (pillsContainer && inspection && inspection.recommendations) {
        pillsContainer.innerHTML = inspection.recommendations.map(r => `
            <button class="action-chip" onclick="executeRecommendation('${r.id}', '${r.action}', '${r.targetFormat || ''}')">
                <i class="fa-solid ${r.icon}"></i> ${r.label}
            </button>
        `).join('');
    }
}

function executeRecommendation(recId, action, targetFormat) {
    if (!activeWorkspaceFile) return;

    if (action === 'convert') {
        openConvertModalForFile(activeWorkspaceFile.id, activeWorkspaceFile.original_name, targetFormat);
    } else if (action === 'compress' || action === 'smart_compress') {
        openSmallerModal();
    } else if (recId.includes('video')) {
        window.location.href = `video-tools.html?fileId=${activeWorkspaceFile.id}&tool=${action}`;
    } else if (recId.includes('image')) {
        window.location.href = `image-tools.html?fileId=${activeWorkspaceFile.id}&tool=${action}`;
    } else if (recId.includes('audio')) {
        window.location.href = `audio-tools.html?fileId=${activeWorkspaceFile.id}&tool=${action}`;
    } else if (recId.includes('pdf') || action === 'merge' || action === 'split' || action === 'watermark') {
        window.location.href = `document-tools.html?fileId=${activeWorkspaceFile.id}&tool=${action}`;
    } else {
        openConvertModalForFile(activeWorkspaceFile.id, activeWorkspaceFile.original_name);
    }
}

function setupModals() {
    // Quick Convert To Button
    const btnQuickConvert = document.getElementById('btn-quick-convert-to');
    if (btnQuickConvert) {
        btnQuickConvert.addEventListener('click', () => {
            if (!activeWorkspaceFile) return showToast('Please select or upload a file first.', 'warning');
            openConvertModalForFile(activeWorkspaceFile.id, activeWorkspaceFile.original_name);
        });
    }

    // Quick Make Smaller Button
    const btnQuickSmaller = document.getElementById('btn-quick-make-smaller');
    if (btnQuickSmaller) {
        btnQuickSmaller.addEventListener('click', () => {
            if (!activeWorkspaceFile) return showToast('Please select or upload a file first.', 'warning');
            openSmallerModal();
        });
    }

    // Convert Modal Close
    const modalConvertClose = document.getElementById('modal-convert-close');
    if (modalConvertClose) {
        modalConvertClose.addEventListener('click', () => {
            document.getElementById('modal-convert-to').classList.add('hidden');
        });
    }

    // Smaller Modal Close
    const modalSmallerClose = document.getElementById('modal-smaller-close');
    if (modalSmallerClose) {
        modalSmallerClose.addEventListener('click', () => {
            document.getElementById('modal-make-smaller').classList.add('hidden');
        });
    }

    // Smaller Preset change
    const smallerSelect = document.getElementById('smaller-preset-select');
    const targetGroup = document.getElementById('smaller-target-group');
    if (smallerSelect && targetGroup) {
        smallerSelect.addEventListener('change', (e) => {
            if (e.target.value === 'target') {
                targetGroup.classList.remove('hidden');
            } else {
                targetGroup.classList.add('hidden');
            }
        });
    }

    // Execute Smart Compress
    const btnExecCompress = document.getElementById('btn-execute-smart-compress');
    if (btnExecCompress) {
        btnExecCompress.addEventListener('click', async () => {
            if (!activeWorkspaceFile) return;
            btnExecCompress.disabled = true;
            btnExecCompress.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Optimizing...';

            try {
                const preset = smallerSelect.value;
                let targetSizeBytes = null;
                if (preset === 'target') {
                    const val = parseFloat(document.getElementById('smaller-target-val').value);
                    const unit = document.getElementById('smaller-target-unit').value;
                    if (val && val > 0) {
                        targetSizeBytes = unit === 'MB' ? Math.round(val * 1024 * 1024) : Math.round(val * 1024);
                    }
                }

                const res = await apiFetch('/api/convert/smart-compress', {
                    method: 'POST',
                    body: { fileId: activeWorkspaceFile.id, targetSizeBytes, qualityPreset: preset }
                });

                document.getElementById('modal-make-smaller').classList.add('hidden');
                showToast(`Optimized! Reduced to ${formatBytes(res.result.convertedSize)} (${res.result.percentageSaved}% saved)`, 'success', 5000, {
                    text: 'Download',
                    onClick: () => window.location.href = res.result.downloadUrl
                });
                await loadDashboardStats();
                await loadTransformationHistory();
            } catch(err) {
                showToast(err.message || 'Optimization failed.', 'error');
            } finally {
                btnExecCompress.disabled = false;
                btnExecCompress.innerHTML = '<i class="fa-solid fa-compress"></i> Compress Now';
            }
        });
    }

    // Multi-Export Execute
    const btnExecMulti = document.getElementById('btn-execute-multi-export');
    if (btnExecMulti) {
        btnExecMulti.addEventListener('click', async () => {
            if (!activeWorkspaceFile) return;
            const checkedFormats = [...document.querySelectorAll('.format-checkbox-tile input[type="checkbox"]:checked')].map(c => c.value);
            if (checkedFormats.length === 0) return showToast('Please select at least 1 format.', 'warning');

            btnExecMulti.disabled = true;
            btnExecMulti.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Converting to ${checkedFormats.length} formats...`;

            try {
                const res = await apiFetch('/api/convert/multi-export', {
                    method: 'POST',
                    body: { fileId: activeWorkspaceFile.id, formats: checkedFormats, createZip: true }
                });

                document.getElementById('modal-convert-to').classList.add('hidden');
                const dlUrl = res.zipResult ? res.zipResult.downloadUrl : res.generatedFiles[0].downloadUrl;
                showToast(`Successfully created ${res.generatedFiles.length} output files!`, 'success', 6000, {
                    text: res.zipResult ? 'Download ZIP' : 'Download',
                    onClick: () => window.location.href = dlUrl
                });

                await loadDashboardStats();
                await loadTransformationHistory();
            } catch(err) {
                showToast(err.message || 'Conversion failed.', 'error');
            } finally {
                btnExecMulti.disabled = false;
                btnExecMulti.innerHTML = '<i class="fa-solid fa-rocket"></i> Convert Selected Formats';
            }
        });
    }

    // Select all formats button
    const btnSelectAll = document.getElementById('btn-select-all-formats');
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            const boxes = document.querySelectorAll('.format-checkbox-tile input[type="checkbox"]');
            const allChecked = [...boxes].every(b => b.checked);
            boxes.forEach(b => {
                b.checked = !allChecked;
                const tile = b.closest('.format-checkbox-tile');
                if (tile) tile.classList.toggle('selected', !allChecked);
            });
            updateSelectedFormatsCount();
        });
    }
}

function openSmallerModal() {
    if (!activeWorkspaceFile) return;
    const modal = document.getElementById('modal-make-smaller');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('modal-smaller-desc').textContent = `Optimizing "${activeWorkspaceFile.original_name}" (${formatBytes(activeWorkspaceFile.file_size)})`;
    }
}

async function openConvertModalForFile(fileId, filename, autoCheckFormat = null) {
    activeWorkspaceFile = { id: fileId, original_name: filename };
    const modal = document.getElementById('modal-convert-to');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.getElementById('modal-convert-filename').textContent = filename;
    const grid = document.getElementById('modal-convert-formats-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary);">Loading formats...</div>';

    try {
        const data = await apiFetch(`/api/convert/formats/${fileId}`);
        const targets = data.targetFormats || [];

        if (targets.length === 0) {
            grid.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary);">No valid conversion formats found.</div>';
            return;
        }

        grid.innerHTML = targets.map(fmt => {
            const meta = (window.ClientFormatRegistry && window.ClientFormatRegistry.formats[fmt]) || { ext: fmt, label: fmt.toUpperCase(), icon: 'fa-file', color: '#64748B' };
            const isChecked = (autoCheckFormat && autoCheckFormat.toLowerCase() === fmt.toLowerCase()) || targets.length === 1;

            return `
                <div class="format-checkbox-tile ${isChecked ? 'selected' : ''}" onclick="toggleFormatTile(this, event)">
                    <input type="checkbox" value="${fmt}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); updateSelectedFormatsCount();">
                    <i class="fa-solid ${meta.icon} format-tile-icon" style="color: ${meta.color};"></i>
                    <span class="format-tile-name">${fmt}</span>
                </div>
            `;
        }).join('');

        updateSelectedFormatsCount();
    } catch(e) {
        grid.innerHTML = `<div style="color:var(--danger); font-size:0.75rem;">Failed to load formats: ${e.message}</div>`;
    }
}

function toggleFormatTile(tile, event) {
    const cb = tile.querySelector('input[type="checkbox"]');
    if (cb) {
        cb.checked = !cb.checked;
        tile.classList.toggle('selected', cb.checked);
        updateSelectedFormatsCount();
    }
}

function updateSelectedFormatsCount() {
    const checked = document.querySelectorAll('.format-checkbox-tile input[type="checkbox"]:checked');
    const countEl = document.getElementById('selected-formats-count');
    if (countEl) countEl.textContent = `${checked.length} format${checked.length === 1 ? '' : 's'} selected`;
}
