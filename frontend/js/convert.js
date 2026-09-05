/**
 * Docholder Universal Transform & Multi-Export Studio Controller
 */

let currentStudioFile = null;
let workspaceFiles = [];
let selectedPreparePreset = 'email';

const CONVERT_MODE_TITLES = {
    multi: 'Universal Multi-Export',
    direct: 'Convert File Format',
    target: 'Optimize to Target Size',
    prepare: 'Prepare File for Sharing',
    batch: 'Batch File Processing'
};

document.addEventListener('DOMContentLoaded', async () => {
    setupModeChips();
    setupDropzone();
    setupControls();
    await loadWorkspaceFiles();

    // Restore workspace state if available
    const savedState = getWorkspaceState('convert_studio');
    const params = new URLSearchParams(window.location.search);
    const initialMode = params.get('mode') || (savedState ? savedState.mode : 'multi');
    switchMode(initialMode);

    const initialFileId = params.get('fileId') || (savedState ? savedState.fileId : null);
    if (initialFileId) {
        const sel = document.getElementById('studio-file-select');
        if (sel) {
            sel.value = initialFileId;
            sel.dispatchEvent(new Event('change'));
        }
    }
});

function setupModeChips() {
    document.querySelectorAll('.action-chips .action-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const mode = chip.getAttribute('data-mode');
            switchMode(mode);
        });
    });
}

function switchMode(mode) {
    const panels = ['multi', 'direct', 'target', 'prepare', 'batch'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`panel-${mode}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const titleEl = document.querySelector('.page-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary);"></i> ${CONVERT_MODE_TITLES[mode] || 'Universal Transform'}`;
    }
    const headerTitle = document.querySelector('.mobile-header-title span');
    if (headerTitle) {
        headerTitle.textContent = CONVERT_MODE_TITLES[mode] || 'Transform & Multi-Export';
    }

    document.querySelectorAll('.action-chips .action-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === mode);
    });

    saveWorkspaceState('convert_studio', {
        mode,
        fileId: currentStudioFile ? currentStudioFile.id : null
    });

    if (mode === 'multi' && currentStudioFile) {
        loadMultiExportFormats(currentStudioFile);
    }
}

async function loadWorkspaceFiles() {
    try {
        const data = await apiFetch('/api/files');
        workspaceFiles = data.files || [];

        const select = document.getElementById('studio-file-select');
        if (select) {
            select.innerHTML = '<option value="">-- Choose from Workspace --</option>';
            workspaceFiles.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                const fId = e.target.value;
                if (!fId) {
                    currentStudioFile = null;
                    return;
                }
                currentStudioFile = workspaceFiles.find(f => String(f.id) === String(fId)) || null;
                if (currentStudioFile) {
                    loadMultiExportFormats(currentStudioFile);
                }
                
                saveWorkspaceState('convert_studio', {
                    mode: document.querySelector('.action-chips .action-chip.active')?.getAttribute('data-mode') || 'multi',
                    fileId: fId
                });
            });
        }

        renderBatchList();
    } catch(e) {}
}

function renderBatchList() {
    const batchList = document.getElementById('batch-files-checkbox-list');
    if (!batchList) return;

    if (workspaceFiles.length === 0) {
        batchList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); padding: 8px;">No workspace files available.</div>';
        updateBatchBtnCount();
        return;
    }

    batchList.innerHTML = workspaceFiles.map(f => `
        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; background:var(--surface); padding:6px 8px; border-radius:var(--radius-xs); border:1px solid var(--surface-border); cursor:pointer;">
            <input type="checkbox" class="batch-file-checkbox" value="${f.id}" onchange="updateBatchBtnCount()">
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);">${f.original_name}</span>
            <span style="font-size:0.72rem; color:var(--text-secondary);">${formatBytes(f.file_size)}</span>
        </label>
    `).join('');

    updateBatchBtnCount();
}

function updateBatchBtnCount() {
    const checked = document.querySelectorAll('.batch-file-checkbox:checked');
    const btn = document.getElementById('run-batch-convert-btn');
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-arrows-split-up-and-left"></i> Convert All (Files Ready: ${checked.length})`;
    }
}

function setupDropzone() {
    const dropzone = document.getElementById('studio-dropzone');
    const input = document.getElementById('studio-file-input');
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', () => input.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await handleFileUpload(e.target.files[0]);
        }
    });
}

async function handleFileUpload(fileObj) {
    const dropzone = document.getElementById('studio-dropzone') || document.getElementById('convert-dropzone');
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

        if (tracker) tracker.update(95, 'Analyzing convertible formats... 95%');
        await new Promise(r => setTimeout(r, 60));

        if (tracker) tracker.ready(fileObj.name);
        showToast(`Uploaded ${res.file.original_name}!`, 'success');
        await loadWorkspaceFiles();
        currentStudioFile = res.file;
        const select = document.getElementById('studio-file-select');
        if (select) select.value = currentStudioFile.id;
        loadMultiExportFormats(currentStudioFile);
    } catch(err) {
        if (tracker) tracker.error(err.message || 'Upload failed');
        showToast(err.message || 'Upload failed.', 'error');
    }
}

async function loadMultiExportFormats(file) {
    const grid = document.getElementById('multi-formats-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); padding:10px;">Analyzing compatible formats...</div>';

    try {
        const res = await apiFetch(`/api/convert/formats/${file.id}`);
        const targets = res.targetFormats || [];

        if (targets.length === 0) {
            grid.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary); padding:10px;">No conversion formats available for this file type.</div>';
            return;
        }

        const sourceExt = (file.original_name || '').split('.').pop().toLowerCase();
        const recList = (window.ClientFormatRegistry && window.ClientFormatRegistry.recommendations[sourceExt]) || [];

        grid.innerHTML = targets.map((fmt, idx) => {
            const meta = (window.ClientFormatRegistry && window.ClientFormatRegistry.formats[fmt]) || { ext: fmt, label: fmt.toUpperCase(), icon: 'fa-file', color: '#64748B' };
            const isRec = recList.includes(fmt);
            const isChecked = idx === 0 || isRec;

            return `
                <div class="format-checkbox-tile ${isChecked ? 'selected' : ''}" onclick="toggleStudioFormatTile(this, event)" style="position: relative;">
                    ${isRec ? '<span style="position: absolute; top: 4px; right: 4px; font-size: 0.62rem; background: var(--accent); color: white; padding: 1px 4px; border-radius: 4px; font-weight: 700;">★ Best</span>' : ''}
                    <input type="checkbox" value="${fmt}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); updateStudioCountBadge();">
                    <i class="fa-solid ${meta.icon} format-tile-icon" style="color: ${meta.color};"></i>
                    <span class="format-tile-name">${fmt.toUpperCase()}</span>
                </div>
            `;
        }).join('');

        // Also dynamically filter the Single Target dropdown
        const directSelect = document.getElementById('target-format-select');
        if (directSelect) {
            directSelect.innerHTML = targets.map(fmt => {
                const meta = (window.ClientFormatRegistry && window.ClientFormatRegistry.formats[fmt]) || { ext: fmt, label: fmt.toUpperCase() };
                return `<option value="${fmt}">${meta.label || fmt.toUpperCase()}</option>`;
            }).join('');
        }

        updateStudioCountBadge();
    } catch(e) {
        grid.innerHTML = `<div style="color:var(--danger); font-size:0.75rem;">Failed to load formats: ${e.message}</div>`;
    }
}

function toggleStudioFormatTile(tile, event) {
    const cb = tile.querySelector('input[type="checkbox"]');
    if (cb) {
        cb.checked = !cb.checked;
        tile.classList.toggle('selected', cb.checked);
        updateStudioCountBadge();
    }
}

function updateStudioCountBadge() {
    const checked = document.querySelectorAll('#multi-formats-grid input[type="checkbox"]:checked');
    const badge = document.getElementById('multi-count-badge');
    if (badge) badge.textContent = `${checked.length} selected`;
}

function setupControls() {
    // Select all formats in Multi-Export
    const btnSelectAll = document.getElementById('btn-multi-select-all');
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            const boxes = document.querySelectorAll('#multi-formats-grid input[type="checkbox"]');
            const allChecked = [...boxes].every(b => b.checked);
            boxes.forEach(b => {
                b.checked = !allChecked;
                const tile = b.closest('.format-checkbox-tile');
                if (tile) tile.classList.toggle('selected', !allChecked);
            });
            updateStudioCountBadge();
        });
    }

    // Select All in Batch Panel
    const btnBatchSelectAll = document.getElementById('btn-batch-select-all');
    if (btnBatchSelectAll) {
        btnBatchSelectAll.addEventListener('click', () => {
            const boxes = document.querySelectorAll('.batch-file-checkbox');
            const allChecked = [...boxes].length > 0 && [...boxes].every(b => b.checked);
            boxes.forEach(b => {
                b.checked = !allChecked;
            });
            btnBatchSelectAll.textContent = allChecked ? 'Select All' : 'Deselect All';
            updateBatchBtnCount();
        });
    }

    // Run Multi-Export
    const btnMultiExport = document.getElementById('run-multi-export-btn');
    if (btnMultiExport) {
        btnMultiExport.addEventListener('click', async () => {
            if (!currentStudioFile) return showToast('Please select or upload a file first.', 'warning');
            const checked = [...document.querySelectorAll('#multi-formats-grid input[type="checkbox"]:checked')].map(c => c.value);
            if (checked.length === 0) return showToast('Please select at least 1 format to export.', 'warning');

            showOperationLoader({
                title: 'Multi-Format Export',
                subtitle: `Generating ${checked.length} export formats simultaneously...`,
                stages: ['Pre-validating format compatibility...', 'Running parallel format conversion pipelines...', 'Bundling outputs into ZIP archive...']
            });

            try {
                const res = await apiFetch('/api/convert/multi-export', {
                    method: 'POST',
                    body: { fileId: currentStudioFile.id, formats: checked, createZip: true }
                });

                hideOperationLoader();
                showToast(`Created ${res.generatedFiles.length} file formats!`, 'success');
                displayResult(res.zipResult || res.generatedFiles[0], currentStudioFile.file_size);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Multi-export failed.', 'error');
            }
        });
    }

    // Run Direct Convert
    const btnDirect = document.getElementById('run-direct-convert-btn');
    if (btnDirect) {
        btnDirect.addEventListener('click', async () => {
            if (!currentStudioFile) return showToast('Please select a file first.', 'warning');
            const targetFormat = document.getElementById('target-format-select')?.value || 'pdf';

            showOperationLoader({
                title: 'Converting File Format',
                subtitle: `Transforming to ${targetFormat.toUpperCase()}...`,
                stages: ['Reading file structure...', `Executing conversion to ${targetFormat.toUpperCase()}...`, 'Generating output asset...']
            });

            try {
                let endpoint = '/api/convert/document';
                if (currentStudioFile.file_type === 'image') endpoint = '/api/image/convert';
                else if (currentStudioFile.file_type === 'video') endpoint = '/api/media/convert-video';
                else if (currentStudioFile.file_type === 'audio') endpoint = '/api/media/convert-audio';

                const res = await apiFetch(endpoint, {
                    method: 'POST',
                    body: { fileId: currentStudioFile.id, format: targetFormat, targetFormat }
                });
                hideOperationLoader();
                showToast('Converted successfully!', 'success');
                displayResult(res.result, currentStudioFile.file_size);
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Conversion failed.', 'error', 5000, {
                    text: 'Try Again',
                    onClick: () => btnDirect.click()
                });
            }
        });
    }

    // Target size preset toggle
    const targetPreset = document.getElementById('target-size-preset');
    const customGroup = document.getElementById('custom-size-group');
    if (targetPreset && customGroup) {
        targetPreset.addEventListener('change', (e) => {
            if (e.target.value === 'custom') customGroup.classList.remove('hidden');
            else customGroup.classList.add('hidden');
        });
    }

    // Run Target Size
    const btnTarget = document.getElementById('run-target-size-btn');
    if (btnTarget) {
        btnTarget.addEventListener('click', async () => {
            if (!currentStudioFile) return showToast('Please select a file first.', 'warning');
            
            let targetBytes = parseInt(targetPreset.value, 10);
            if (targetPreset.value === 'custom') {
                const customVal = parseFloat(document.getElementById('custom-size-input').value);
                const unit = document.getElementById('custom-size-unit').value;
                targetBytes = unit === 'MB' ? Math.round(customVal * 1024 * 1024) : Math.round(customVal * 1024);
            }

            showOperationLoader({
                title: 'Optimizing to Target Size',
                subtitle: `Compressing below ${formatBytes(targetBytes)}...`,
                stages: ['Analyzing file payload...', 'Iterative compression passes...', 'Verifying size constraints...']
            });

            try {
                const res = await apiFetch('/api/convert/smart-compress', {
                    method: 'POST',
                    body: { fileId: currentStudioFile.id, targetSizeBytes: targetBytes }
                });
                hideOperationLoader();
                showToast('Optimized successfully!', 'success');
                displayResult(res.result, currentStudioFile.file_size);
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Optimization failed.', 'error');
            }
        });
    }

    // Prepare Preset buttons
    document.querySelectorAll('.prepare-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.prepare-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPreparePreset = btn.getAttribute('data-preset');
        });
    });

    const btnPrepare = document.getElementById('run-prepare-btn');
    if (btnPrepare) {
        btnPrepare.addEventListener('click', async () => {
            if (!currentStudioFile) return showToast('Please select a file first.', 'warning');

            showOperationLoader({
                title: 'Preparing File for Sharing',
                subtitle: `Applying '${selectedPreparePreset}' preset...`,
                stages: ['Optimizing asset stream...', 'Sanitizing metadata & compressing...', 'Finalizing deliverable...']
            });

            try {
                const res = await apiFetch('/api/convert/prepare', {
                    method: 'POST',
                    body: { fileId: currentStudioFile.id, preset: selectedPreparePreset }
                });
                hideOperationLoader();
                showToast('File prepared!', 'success');
                displayResult(res.result, currentStudioFile.file_size);
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Prepare failed.', 'error');
            }
        });
    }

    // Batch Convert
    const btnBatch = document.getElementById('run-batch-convert-btn');
    if (btnBatch) {
        btnBatch.addEventListener('click', async () => {
            const checkedBoxes = [...document.querySelectorAll('.batch-file-checkbox:checked')];
            const checkedIds = checkedBoxes.map(c => c.value);
            if (checkedIds.length === 0) return showToast('Please select at least 1 file to batch convert.', 'warning');
            const format = document.getElementById('batch-target-format')?.value || 'pdf';

            // Show batch progress wrapper
            const progressWrapper = document.getElementById('batch-progress-wrapper');
            const progressFill = document.getElementById('batch-progress-fill');
            const progressPercent = document.getElementById('batch-progress-percent');
            const progressStatus = document.getElementById('batch-progress-summary-status');
            const rowsList = document.getElementById('batch-rows-status-list');
            const summaryCard = document.getElementById('batch-summary-card');

            if (summaryCard) summaryCard.classList.add('hidden');
            if (progressWrapper) progressWrapper.classList.remove('hidden');

            const selectedFiles = checkedIds.map(id => workspaceFiles.find(f => String(f.id) === String(id))).filter(Boolean);

            if (rowsList) {
                rowsList.innerHTML = selectedFiles.map(f => `
                    <div id="batch-row-${f.id}" style="display:flex; justify-content:space-between; align-items:center; padding:3px 6px; background:var(--surface); border-radius:4px; border:1px solid var(--surface-border);">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${f.original_name}</span>
                        <span class="row-status" style="color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Converting...</span>
                    </div>
                `).join('');
            }

            if (progressPercent) progressPercent.textContent = '20%';
            if (progressFill) progressFill.style.width = '20%';
            if (progressStatus) progressStatus.textContent = `Queueing ${checkedIds.length} files for conversion...`;

            try {
                if (progressPercent) progressPercent.textContent = '50%';
                if (progressFill) progressFill.style.width = '50%';
                if (progressStatus) progressStatus.textContent = `Processing ${checkedIds.length} files in parallel...`;

                const res = await apiFetch('/api/convert/batch', {
                    method: 'POST',
                    body: { fileIds: checkedIds, format, bundleZip: true }
                });

                if (progressPercent) progressPercent.textContent = '100%';
                if (progressFill) progressFill.style.width = '100%';
                if (progressStatus) progressStatus.textContent = 'Batch completed!';

                await new Promise(r => setTimeout(r, 400));
                if (progressWrapper) progressWrapper.classList.add('hidden');

                // Render Summary Card
                if (summaryCard) {
                    summaryCard.classList.remove('hidden');
                    const doneCount = res.successful || (res.results ? res.results.length : 0);
                    const totalCount = res.total || checkedIds.length;
                    
                    const badge = document.getElementById('batch-summary-badge');
                    if (badge) badge.textContent = `${doneCount} / ${totalCount} Done`;

                    const completedList = document.getElementById('batch-completed-files-list');
                    if (completedList) {
                        const items = res.results || [];
                        completedList.innerHTML = items.map(r => `
                            <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.78rem; background:var(--surface); padding:6px 10px; border-radius:var(--radius-xs); border:1px solid var(--surface-border);">
                                <div style="display:flex; align-items:center; gap:6px; overflow:hidden; max-width:75%;">
                                    <i class="fa-solid fa-circle-check" style="color:var(--success);"></i>
                                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);">${r.originalName || r.filename}</span>
                                </div>
                                <a href="${r.downloadUrl}" download="${r.originalName || r.filename}" class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding:2px 8px;">
                                    <i class="fa-solid fa-download"></i>
                                </a>
                            </div>
                        `).join('');
                    }

                    // Render Failed Section if any
                    const failedSec = document.getElementById('batch-failed-section');
                    const failedList = document.getElementById('batch-failed-list');
                    const retryBtn = document.getElementById('btn-retry-failed-batch');

                    if (res.failed && res.failed.length > 0) {
                        if (failedSec) failedSec.classList.remove('hidden');
                        if (failedList) {
                            failedList.innerHTML = res.failed.map(f => `<div>• <strong>${f.filename || 'File'}</strong>: ${f.error || 'Conversion failed'}</div>`).join('');
                        }
                        if (retryBtn) {
                            retryBtn.onclick = () => {
                                const failedIds = res.failed.map(f => String(f.fileId));
                                document.querySelectorAll('.batch-file-checkbox').forEach(cb => {
                                    cb.checked = failedIds.includes(String(cb.value));
                                });
                                updateBatchBtnCount();
                                btnBatch.click();
                            };
                        }
                    } else {
                        if (failedSec) failedSec.classList.add('hidden');
                    }

                    // Wire ZIP download
                    const zipBtn = document.getElementById('btn-batch-download-zip');
                    if (zipBtn) {
                        if (res.zipResult && res.zipResult.downloadUrl) {
                            zipBtn.href = res.zipResult.downloadUrl;
                            zipBtn.download = res.zipResult.originalName || 'batch_converted.zip';
                            zipBtn.classList.remove('hidden');
                        } else if (res.results && res.results.length > 0) {
                            zipBtn.href = res.results[0].downloadUrl;
                            zipBtn.download = res.results[0].originalName || res.results[0].filename;
                            zipBtn.classList.remove('hidden');
                        } else {
                            zipBtn.classList.add('hidden');
                        }
                    }

                    summaryCard.scrollIntoView({ behavior: 'smooth' });
                }

                showToast(`Batch conversion complete (${res.successful || 0} succeeded)!`, 'success');
            } catch(e) {
                if (progressWrapper) progressWrapper.classList.add('hidden');
                showToast(e.message || 'Batch conversion failed.', 'error');
            }
        });
    }
}

function displayResult(result, originalSize = 0) {
    const card = document.getElementById('studio-result-card');
    if (!card) return;
    card.classList.remove('hidden');

    const origSize = result.originalSize || originalSize || 0;
    const newSize = result.convertedSize || result.fileSize || 0;
    const pct = result.percentageSaved || (origSize > 0 && newSize < origSize ? Math.round(((origSize - newSize) / origSize) * 100) : 0);

    document.getElementById('res-orig-size').textContent = formatBytes(origSize);
    document.getElementById('res-new-size').textContent = formatBytes(newSize);
    document.getElementById('res-savings-badge').textContent = `${pct}% Saved`;
    document.getElementById('res-file-name').textContent = result.originalName || 'output.zip';

    const dl = document.getElementById('res-download-btn');
    if (dl) {
        dl.href = result.downloadUrl;
        dl.download = result.originalName;
    }

    // Respect auto-download setting
    const settings = getDocholderSettings();
    if (settings.autoDownload && dl && dl.href) {
        const autoLink = document.createElement('a');
        autoLink.href = dl.href;
        autoLink.download = result.originalName;
        document.body.appendChild(autoLink);
        autoLink.click();
        autoLink.remove();
    }

    card.scrollIntoView({ behavior: 'smooth' });
}

