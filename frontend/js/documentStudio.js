/**
 * Docholder Document Studio Client Logic
 */

let currentDocFile = null;
let workspaceDocs = [];
let selectedMergeFiles = [];
let sigCanvas = null;
let sigCtx = null;
let isDrawingSig = false;
let uploadedSigDataUrl = null;

const MODE_META = {
    convert: { title: 'Convert PDF & Document', icon: 'fa-rotate', color: '#00F0FF', subtitle: 'Convert PDF to Word, PowerPoint, Image, Text, Excel, or reverse.' },
    compress: { title: 'Compress PDF', icon: 'fa-compress', color: '#10B981', subtitle: 'Reduce PDF file size with smart stream, font, and object optimization.' },
    protect: { title: 'Protect PDF', icon: 'fa-lock', color: '#EF4444', subtitle: 'Secure your document with password encryption and access permissions.' },
    sign: { title: 'Sign PDF', icon: 'fa-signature', color: '#6366F1', subtitle: 'Draw, type, or upload an authentic signature and stamp directly onto pages.' },
    annotate: { title: 'Annotate PDF', icon: 'fa-highlighter', color: '#F59E0B', subtitle: 'Add highlights, notes, stamps, and shapes embedded into the document.' },
    redact: { title: 'Redact PDF', icon: 'fa-eraser', color: '#EF4444', subtitle: 'Permanently blackout sensitive personal, financial, or confidential data.' },
    merge: { title: 'Merge PDF Documents', icon: 'fa-object-group', color: '#3B82F6', subtitle: 'Combine multiple PDF documents into a single organized file in exact order.' },
    split: { title: 'Split PDF Pages', icon: 'fa-scissors', color: '#8B5CF6', subtitle: 'Extract specific page ranges into a separate document.' },
    extract: { title: 'Extract Specific Pages', icon: 'fa-file-export', color: '#10B981', subtitle: 'Pick individual page numbers to generate a clean sub-document.' },
    remove: { title: 'Remove PDF Pages', icon: 'fa-trash-can', color: '#EF4444', subtitle: 'Delete unwanted or blank pages from your PDF.' },
    rotate: { title: 'Rotate PDF Pages', icon: 'fa-rotate', color: '#06B6D4', subtitle: 'Rotate orientation of pages by 90°, 180°, or 270°.' },
    watermark: { title: 'Stamp Watermark on PDF', icon: 'fa-stamp', color: '#F97316', subtitle: 'Embed angled text watermarks across document pages.' },
    pagenum: { title: 'Add Page Numbers to PDF', icon: 'fa-list-ol', color: '#0EA5E9', subtitle: 'Stamp dynamic page counters (e.g. Page X of Y) in margins.' },
    pdfa: { title: 'Convert to ISO PDF/A Archival', icon: 'fa-file-shield', color: '#DC2626', subtitle: 'Converts PDF into PDF/A-1b compliant format for long-term legal archiving.' },
    compare: { title: 'Compare Two PDF Documents', icon: 'fa-code-compare', color: '#8B5CF6', subtitle: 'Analyze textual differences and similarity scores between two documents.' }
};

document.addEventListener('DOMContentLoaded', async () => {
    setupModeChips();
    setupDropzone();
    setupControls();
    initSignaturePad();
    setupSignatureTabs();
    setupColorPickers();
    setupRedactPresets();
    await loadWorkspaceDocs();

    // Restore workspace state if available
    const savedState = getWorkspaceState('document_studio');
    const params = new URLSearchParams(window.location.search);
    const initialTool = params.get('tool') || (savedState ? savedState.mode : 'convert');
    switchMode(initialTool);

    const initialFileId = params.get('fileId') || (savedState ? savedState.fileId : null);
    if (initialFileId) {
        const sel = document.getElementById('doc-file-select');
        if (sel) {
            sel.value = initialFileId;
            sel.dispatchEvent(new Event('change'));
        }
    }
});

function setupModeChips() {
    document.querySelectorAll('#doc-mode-selector .action-chip, .action-chips .action-chip, .category-nav-bar .action-chip, .action-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const mode = chip.getAttribute('data-mode');
            if (mode) switchMode(mode);
        });
    });
}

function switchMode(mode) {
    const panels = ['convert', 'compress', 'protect', 'sign', 'annotate', 'redact', 'merge', 'split', 'extract', 'remove', 'rotate', 'watermark', 'pagenum', 'pdfa', 'compare'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`panel-${mode}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const meta = MODE_META[mode] || { title: 'PDF Studio', icon: 'fa-file-pdf', color: '#EF4444', subtitle: 'Intelligent PDF operations and transformations.' };

    const breadcrumb = document.getElementById('op-breadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = `<i class="fa-solid fa-file-pdf"></i> PDF → ${meta.title}`;
    }

    const titleEl = document.getElementById('main-op-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid ${meta.icon}" style="color: ${meta.color};"></i> ${meta.title}`;
    }

    const subEl = document.getElementById('main-op-subtitle');
    if (subEl) {
        subEl.textContent = meta.subtitle;
    }

    const headerTitle = document.getElementById('header-operation-title');
    if (headerTitle) {
        headerTitle.textContent = meta.title;
    }

    const isMultiMode = (mode === 'merge');
    const singleGroup = document.getElementById('single-doc-select-group');
    const multiGroup = document.getElementById('multi-doc-select-group');
    if (singleGroup && multiGroup) {
        if (isMultiMode) {
            singleGroup.classList.add('hidden');
            multiGroup.classList.remove('hidden');
        } else {
            singleGroup.classList.remove('hidden');
            multiGroup.classList.add('hidden');
        }
    }

    document.querySelectorAll('#doc-mode-selector .action-chip, .action-chips .action-chip, .category-nav-bar .action-chip, .action-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === mode);
    });

    saveWorkspaceState('document_studio', {
        mode,
        fileId: currentDocFile ? currentDocFile.id : null
    });
}

function setupSignatureTabs() {
    document.querySelectorAll('.doc-sig-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.doc-sig-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const sigMode = btn.getAttribute('data-sig-mode');
            document.querySelectorAll('.sig-mode-view').forEach(v => v.classList.add('hidden'));

            const targetView = document.getElementById(`sig-mode-${sigMode}`);
            if (targetView) targetView.classList.remove('hidden');
        });
    });

    const fileInput = document.getElementById('sign-image-upload');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
                uploadedSigDataUrl = loadEvt.target.result;
                const previewImg = document.getElementById('sig-image-preview');
                const previewBox = document.getElementById('sig-image-preview-box');
                if (previewImg && previewBox) {
                    previewImg.src = uploadedSigDataUrl;
                    previewBox.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const sizeSlider = document.getElementById('sign-size-slider');
    const sizeVal = document.getElementById('sign-size-val');
    if (sizeSlider && sizeVal) {
        sizeSlider.addEventListener('input', (e) => {
            sizeVal.textContent = `${e.target.value}%`;
        });
    }
}

function setupColorPickers() {
    document.querySelectorAll('.color-dot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-dot-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const hidden = document.getElementById('ann-color-hidden');
            if (hidden) hidden.value = btn.getAttribute('data-color');
        });
    });
}

function setupRedactPresets() {
    const sel = document.getElementById('redact-preset');
    const customBox = document.getElementById('redact-custom-coords');
    if (sel && customBox) {
        sel.addEventListener('change', () => {
            if (sel.value === 'custom') {
                customBox.classList.remove('hidden');
            } else {
                customBox.classList.add('hidden');
            }
        });
    }
}

function initSignaturePad() {
    sigCanvas = document.getElementById('signature-pad');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#1E293B';

    function getCoords(e) {
        const rect = sigCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (sigCanvas.width / rect.width),
            y: (clientY - rect.top) * (sigCanvas.height / rect.height)
        };
    }

    function startDraw(e) {
        e.preventDefault();
        isDrawingSig = true;
        const { x, y } = getCoords(e);
        sigCtx.beginPath();
        sigCtx.moveTo(x, y);
    }

    function drawMove(e) {
        if (!isDrawingSig) return;
        e.preventDefault();
        const { x, y } = getCoords(e);
        sigCtx.lineTo(x, y);
        sigCtx.stroke();
    }

    function endDraw(e) {
        if (isDrawingSig) {
            e.preventDefault();
            isDrawingSig = false;
        }
    }

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', drawMove);
    window.addEventListener('mouseup', endDraw);

    sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
    sigCanvas.addEventListener('touchmove', drawMove, { passive: false });
    sigCanvas.addEventListener('touchend', endDraw, { passive: false });

    const btnClear = document.getElementById('btn-clear-sig');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        });
    }
}

async function loadWorkspaceDocs() {
    try {
        const data = await apiFetch('/api/files?category=doc');
        // Filter strictly to PDF files for PDF Studio (Requirement 5)
        workspaceDocs = (data.files || []).filter(f => 
            f.mime_type === 'application/pdf' || 
            (f.original_name && f.original_name.toLowerCase().endsWith('.pdf'))
        );

        const select = document.getElementById('doc-file-select');
        const compareSelect = document.getElementById('doc-compare-select');
        if (select) {
            select.innerHTML = '<option value="">-- Choose from Workspace --</option>';
            workspaceDocs.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                const fId = e.target.value;
                currentDocFile = workspaceDocs.find(f => String(f.id) === String(fId)) || null;
                updateSelectedDocBadge(currentDocFile);
                saveWorkspaceState('document_studio', {
                    mode: document.querySelector('.action-chip.active')?.getAttribute('data-mode') || 'convert',
                    fileId: fId
                });
            });
        }

        if (compareSelect) {
            compareSelect.innerHTML = '<option value="">-- Choose Second PDF --</option>';
            workspaceDocs.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.original_name;
                compareSelect.appendChild(opt);
            });
        }

        renderMultiDocList();
    } catch(e) {}
}

function updateSelectedDocBadge(file) {
    const badge = document.getElementById('selected-doc-badge');
    const nameEl = document.getElementById('selected-doc-name');
    const sizeEl = document.getElementById('selected-doc-size');
    if (badge && nameEl && sizeEl) {
        if (file) {
            badge.classList.remove('hidden');
            nameEl.textContent = file.original_name;
            sizeEl.textContent = formatBytes(file.file_size);

            const dropzone = document.getElementById('doc-dropzone');
            if (dropzone && typeof renderHeavyFileInspector === 'function') {
                renderHeavyFileInspector(dropzone, file, { mediaType: 'doc' });
            }
        } else {
            badge.classList.add('hidden');
            const tb = document.getElementById('heavy-file-telemetry-box');
            if (tb) tb.remove();
        }
    }
}

function renderMultiDocList() {
    const container = document.getElementById('doc-multi-checkbox-list');
    if (!container) return;

    if (workspaceDocs.length === 0) {
        container.innerHTML = '<div style="font-size: 0.76rem; color: var(--text-secondary);">No PDF documents in workspace. Upload below.</div>';
        selectedMergeFiles = [];
        renderMergeOrderedList();
        return;
    }

    // Default select first 2 if selectedMergeFiles is empty
    if (selectedMergeFiles.length === 0 && workspaceDocs.length >= 2) {
        selectedMergeFiles = [workspaceDocs[0], workspaceDocs[1]];
    }

    container.innerHTML = workspaceDocs.map(doc => {
        const isChecked = selectedMergeFiles.some(f => String(f.id) === String(doc.id));
        return `
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; background: var(--surface); padding: 6px 10px; border-radius: var(--radius-xs); border: 1px solid var(--surface-border); cursor: pointer;">
                <input type="checkbox" class="multi-doc-checkbox" value="${doc.id}" ${isChecked ? 'checked' : ''}>
                <i class="fa-solid fa-file-pdf" style="color: #EF4444;"></i>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.original_name}</span>
                <span style="color: var(--text-secondary); font-size: 0.72rem;">${formatBytes(doc.file_size)}</span>
            </label>
        `;
    }).join('');

    container.querySelectorAll('.multi-doc-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const docId = cb.value;
            const doc = workspaceDocs.find(d => String(d.id) === String(docId));
            if (!doc) return;

            if (cb.checked) {
                if (!selectedMergeFiles.some(f => String(f.id) === String(docId))) {
                    selectedMergeFiles.push(doc);
                }
            } else {
                selectedMergeFiles = selectedMergeFiles.filter(f => String(f.id) !== String(docId));
            }
            renderMergeOrderedList();
        });
    });

    renderMergeOrderedList();
}

function renderMergeOrderedList() {
    const listEl = document.getElementById('merge-ordered-list');
    const badge = document.getElementById('merge-file-count-badge');
    if (!listEl) return;

    if (badge) badge.textContent = `${selectedMergeFiles.length} FILES SELECTED`;

    if (selectedMergeFiles.length === 0) {
        listEl.innerHTML = `
            <div id="merge-empty-state" style="text-align: center; padding: 16px; border: 1px dashed var(--surface-border); border-radius: var(--radius-xs); color: var(--text-muted); font-size: 0.8rem;">
                <i class="fa-solid fa-file-circle-plus" style="font-size: 1.5rem; margin-bottom: 6px; display: block; color: var(--primary);"></i>
                Select 2 or more PDFs in Step 1 to arrange their order
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    selectedMergeFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--surface-hover); border: 1px solid var(--surface-border); border-radius: var(--radius-xs); gap: 8px;';
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1;">
                <span class="hud-badge hud-badge-cyan" style="font-size: 0.62rem; min-width: 24px; text-align: center;">#${index + 1}</span>
                <i class="fa-solid fa-file-pdf" style="color: #EF4444; font-size: 1.1rem; flex-shrink: 0;"></i>
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.original_name}</div>
                    <div style="font-size: 0.72rem; color: var(--text-secondary);">${formatBytes(file.file_size)}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                <button type="button" class="btn btn-secondary btn-sm merge-btn-up" style="padding: 4px 8px; font-size: 0.75rem;" ${index === 0 ? 'disabled' : ''} title="Move Up">
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-sm merge-btn-down" style="padding: 4px 8px; font-size: 0.75rem;" ${index === selectedMergeFiles.length - 1 ? 'disabled' : ''} title="Move Down">
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button type="button" class="btn btn-danger btn-sm merge-btn-remove" style="padding: 4px 8px; font-size: 0.75rem;" title="Remove File">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        item.querySelector('.merge-btn-up')?.addEventListener('click', () => {
            if (index > 0) {
                const temp = selectedMergeFiles[index];
                selectedMergeFiles[index] = selectedMergeFiles[index - 1];
                selectedMergeFiles[index - 1] = temp;
                renderMergeOrderedList();
            }
        });

        item.querySelector('.merge-btn-down')?.addEventListener('click', () => {
            if (index < selectedMergeFiles.length - 1) {
                const temp = selectedMergeFiles[index];
                selectedMergeFiles[index] = selectedMergeFiles[index + 1];
                selectedMergeFiles[index + 1] = temp;
                renderMergeOrderedList();
            }
        });

        item.querySelector('.merge-btn-remove')?.addEventListener('click', () => {
            selectedMergeFiles.splice(index, 1);
            const cb = document.querySelector(`.multi-doc-checkbox[value="${file.id}"]`);
            if (cb) cb.checked = false;
            renderMergeOrderedList();
        });

        listEl.appendChild(item);
    });
}

function setupDropzone() {
    const dropzone = document.getElementById('doc-dropzone');
    const fileInput = document.getElementById('doc-file-input');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            await uploadFileDirect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await uploadFileDirect(e.target.files[0]);
        }
    });
}

async function uploadFileDirect(file) {
    const dropzone = document.getElementById('doc-dropzone');
    const tracker = typeof renderFileUploadTracker === 'function' ? renderFileUploadTracker(dropzone, file) : null;

    try {
        if (tracker) tracker.update(25, 'Loading document... 25%', 'Est: ~1s');
        await new Promise(r => setTimeout(r, 100));

        if (tracker) tracker.update(60, 'Reading file contents... 60%', 'Est: ~1s');

        const res = await uploadFileWithProgress('/api/files/upload', file, (p) => {
            if (tracker && p.percent) {
                const scaled = Math.min(88, Math.max(25, Math.round(p.percent * 0.88)));
                tracker.update(scaled, `Reading file contents... ${scaled}%`);
            }
        });

        if (tracker) tracker.update(92, 'Preparing document... 92%');
        await new Promise(r => setTimeout(r, 80));

        if (tracker) tracker.ready(file.name);
        showToast('Document loaded successfully!', 'success');
        await loadWorkspaceDocs();
        
        const sel = document.getElementById('doc-file-select');
        if (sel && res.file) {
            sel.value = res.file.id;
            currentDocFile = res.file;
            updateSelectedDocBadge(currentDocFile);
        }
    } catch(e) {
        if (tracker) tracker.error(e.message || 'Upload failed');
        showToast(e.message || 'Upload failed.', 'error');
    }
}

function setupControls() {
    // 0. Convert PDF Document
    const btnConvert = document.getElementById('btn-apply-convert');
    if (btnConvert) {
        btnConvert.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select or upload a document first.', 'warning');
            const targetFormat = document.getElementById('convert-target-format')?.value || 'docx';

            const progressWrapper = document.getElementById('convert-progress-wrapper');
            const progressFill = document.getElementById('convert-progress-fill');
            const progressStatus = document.getElementById('convert-progress-status');
            const progressPercent = document.getElementById('convert-progress-percent');

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '25%';
            if (progressPercent) progressPercent.textContent = '25%';
            if (progressStatus) progressStatus.textContent = `Analyzing ${currentDocFile.original_name}...`;

            btnConvert.disabled = true;
            btnConvert.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting...';

            try {
                if (progressFill) progressFill.style.width = '65%';
                if (progressPercent) progressPercent.textContent = '65%';
                if (progressStatus) progressStatus.textContent = `Rendering format (.${targetFormat})...`;

                const res = await apiFetch('/api/convert/document', {
                    method: 'POST',
                    body: {
                        fileId: currentDocFile.id,
                        format: targetFormat
                    }
                });

                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'Conversion complete!';

                showToast(`Converted to ${targetFormat.toUpperCase()} successfully!`, 'success');
                if (window.DocholderAudio) window.DocholderAudio.playSuccess();
                if (res.result) {
                    DocholderStorage.addRecentFile(res.result);
                }

                displayDocResult({
                    originalName: res.result.originalName,
                    downloadUrl: res.result.downloadUrl,
                    fileSize: res.result.convertedSize
                }, `Converted to ${targetFormat.toUpperCase()}!`);
            } catch(e) {
                showToast(e.message || 'Conversion failed.', 'error');
                if (progressStatus) progressStatus.textContent = 'Conversion failed.';
            } finally {
                btnConvert.disabled = false;
                btnConvert.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert Document Now';
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2500);
            }
        });
    }

    // 1. Protect PDF (Section 2)
    const btnProtect = document.getElementById('btn-protect-doc');
    if (btnProtect) {
        btnProtect.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const password = document.getElementById('protect-password')?.value || '';
            const confirmPassword = document.getElementById('protect-confirm-password')?.value || '';

            if (!password.trim()) {
                return showToast('Please enter a password to protect the PDF.', 'warning');
            }
            if (password !== confirmPassword) {
                return showToast('Passwords do not match. Please verify.', 'error');
            }

            const allowPrint = document.getElementById('protect-allow-print')?.checked !== false;
            const allowCopy = document.getElementById('protect-allow-copy')?.checked !== false;
            const allowEdit = document.getElementById('protect-allow-edit')?.checked === true;

            showOperationLoader({
                title: 'Protecting PDF Document',
                subtitle: 'Securing document with password encryption...',
                stages: ['Initializing cryptographic cipher...', 'Enforcing permission restrictions...', 'Generating protected PDF...']
            });

            try {
                const res = await apiFetch('/api/pdf/protect', {
                    method: 'POST',
                    body: {
                        fileId: currentDocFile.id,
                        password,
                        confirmPassword,
                        allowPrint,
                        allowCopy,
                        allowEdit
                    }
                });
                hideOperationLoader();
                showToast('PDF protected successfully with password!', 'success');
                displayDocResult(res.result, 'PDF Protected Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'PDF protection failed.', 'error', 5000, {
                    text: 'Try Again',
                    onClick: () => btnProtect.click()
                });
            }
        });
    }

    // 2. Sign PDF (Section 4)
    const btnSign = document.getElementById('btn-sign-doc');
    if (btnSign) {
        btnSign.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');

            const activeSigTab = document.querySelector('.doc-sig-tab-btn.active')?.getAttribute('data-sig-mode') || 'draw';
            let imageData = null;
            let signerName = null;

            if (activeSigTab === 'draw') {
                if (sigCanvas) {
                    imageData = sigCanvas.toDataURL('image/png');
                }
            } else if (activeSigTab === 'upload') {
                imageData = uploadedSigDataUrl;
            } else {
                signerName = document.getElementById('sign-name-input')?.value?.trim() || '';
            }

            if (!imageData && !signerName) {
                return showToast('Please provide a signature (draw, type name, or upload).', 'warning');
            }

            const pageNum = parseInt(document.getElementById('sign-page-num')?.value || '1', 10) - 1;
            const preset = document.getElementById('sign-position-preset')?.value || 'bottom-right';
            const scale = parseFloat(document.getElementById('sign-size-slider')?.value || '100') / 100;

            let x = 380, y = 70;
            if (preset === 'bottom-left') { x = 60; y = 70; }
            else if (preset === 'bottom-center') { x = 220; y = 70; }
            else if (preset === 'top-right') { x = 380; y = 700; }

            const width = Math.round(160 * scale);
            const height = Math.round(60 * scale);

            showOperationLoader({
                title: 'Signing PDF Document',
                subtitle: 'Stamping authentic signature onto document...',
                stages: ['Rendering signature asset...', 'Calculating page coordinates...', 'Exporting signed document...']
            });

            try {
                const res = await apiFetch('/api/pdf/sign', {
                    method: 'POST',
                    body: {
                        fileId: currentDocFile.id,
                        signatureData: {
                            imageData,
                            signerName,
                            page: Math.max(0, pageNum),
                            x,
                            y,
                            width,
                            height
                        }
                    }
                });
                hideOperationLoader();
                showToast('PDF signed successfully!', 'success');
                displayDocResult(res.result, 'PDF Signed Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Signing failed.', 'error');
            }
        });
    }

    // 3. Annotate PDF (Section 5)
    const btnAnnotate = document.getElementById('btn-annotate-doc');
    if (btnAnnotate) {
        btnAnnotate.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');

            const annType = document.getElementById('ann-type')?.value || 'highlight';
            const annText = document.getElementById('ann-text')?.value || 'Approved';
            const pageNum = parseInt(document.getElementById('ann-page')?.value || '1', 10) - 1;
            const color = document.getElementById('ann-color-hidden')?.value || '#FBBF24';
            const pos = document.getElementById('ann-pos-select')?.value || 'top';

            let y = 100;
            if (pos === 'middle') y = 400;
            if (pos === 'bottom') y = 700;

            const annotations = [{
                type: annType,
                text: annText,
                page: Math.max(0, pageNum),
                color,
                x: 60,
                y,
                width: 280,
                height: 28,
                opacity: annType === 'highlight' ? 0.35 : 1
            }];

            showOperationLoader({
                title: 'Saving Annotations',
                subtitle: 'Embedding visual annotations into PDF...',
                stages: ['Reading PDF page stream...', 'Drawing visual annotations...', 'Saving updated document...']
            });

            try {
                const res = await apiFetch('/api/pdf/annotate', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, annotations }
                });
                hideOperationLoader();
                showToast('Annotations saved successfully!', 'success');
                displayDocResult(res.result, 'Annotations Applied Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Annotation failed.', 'error');
            }
        });
    }

    // 4. Redact PDF (Section 6)
    const btnRedact = document.getElementById('btn-redact-doc');
    if (btnRedact) {
        btnRedact.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');

            const pageNum = parseInt(document.getElementById('redact-page-num')?.value || '1', 10) - 1;
            const preset = document.getElementById('redact-preset')?.value || 'account_num';

            let redacts = [];
            if (preset === 'header') {
                redacts.push({ page: pageNum, x: 40, y: 30, width: 515, height: 45 });
            } else if (preset === 'footer') {
                redacts.push({ page: pageNum, x: 40, y: 760, width: 515, height: 45 });
            } else if (preset === 'custom') {
                const custX = parseFloat(document.getElementById('redact-custom-x')?.value || '60');
                const custY = parseFloat(document.getElementById('redact-custom-y')?.value || '200');
                redacts.push({ page: pageNum, x: custX, y: custY, width: 300, height: 40 });
            } else {
                redacts.push({ page: pageNum, x: 60, y: 220, width: 340, height: 35 });
            }

            showOperationLoader({
                title: 'Redacting PDF Content',
                subtitle: 'Permanently blanking sensitive content...',
                stages: ['Locating target coordinates...', 'Applying opaque blackout masks...', 'Exporting sanitized document...']
            });

            try {
                const res = await apiFetch('/api/pdf/redact', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, redacts }
                });
                hideOperationLoader();
                showToast('PDF redacted successfully!', 'success');
                displayDocResult(res.result, 'PDF Redacted Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Redaction failed.', 'error');
            }
        });
    }

    // PDF Compress Engine (Requirement 1)
    const btnCompress = document.getElementById('btn-compress-pdf');
    if (btnCompress) {
        btnCompress.addEventListener('click', async () => {
            if (!currentDocFile) {
                return showToast('Please select a PDF document first.', 'warning');
            }
            if (!currentDocFile.mime_type.includes('pdf') && !currentDocFile.original_name.toLowerCase().endsWith('.pdf')) {
                return showToast('Please select a valid PDF document to compress.', 'warning');
            }

            const level = document.querySelector('input[name="pdf-compress-level"]:checked')?.value || 'recommended';
            const progressWrapper = document.getElementById('compress-progress-wrapper');
            const progressStatus = document.getElementById('compress-progress-status');
            const progressPercent = document.getElementById('compress-progress-percent');
            const progressFill = document.getElementById('compress-progress-fill');

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressPercent) progressPercent.textContent = '15%';
            if (progressFill) progressFill.style.width = '15%';
            if (progressStatus) progressStatus.textContent = 'Analyzing PDF stream tree...';

            if (typeof DocholderUI !== 'undefined') {
                DocholderUI.setButtonState(btnCompress, 'loading', 'Compressing PDF...');
            } else {
                btnCompress.disabled = true;
            }

            let stageTimer = setInterval(() => {
                if (progressPercent && progressFill && progressStatus) {
                    let cur = parseInt(progressPercent.textContent || '15', 10);
                    if (cur < 85) {
                        cur += 18;
                        progressPercent.textContent = `${cur}%`;
                        progressFill.style.width = `${cur}%`;
                        if (cur >= 35 && cur < 65) progressStatus.textContent = 'Compressing embedded fonts & images...';
                        if (cur >= 65) progressStatus.textContent = 'Optimizing object streams...';
                    }
                }
            }, 250);

            try {
                const res = await apiFetch('/api/pdf/compress', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, level }
                });

                clearInterval(stageTimer);
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressFill) progressFill.style.width = '100%';
                if (progressStatus) progressStatus.textContent = 'Compression complete ✓';

                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnCompress, 'ready', '<i class="fa-solid fa-compress"></i> Compress PDF');
                } else {
                    btnCompress.disabled = false;
                }

                if (res.cannotCompressFurther) {
                    showToast('This PDF cannot be compressed further significantly.', 'info', 4000);
                } else {
                    showToast('PDF compressed successfully!', 'success');
                }

                displayDocResult(res.result, 'PDF Compression Complete', res.cannotCompressFurther ? 'This PDF cannot be compressed further significantly.' : null);
            } catch(e) {
                clearInterval(stageTimer);
                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnCompress, 'ready', '<i class="fa-solid fa-compress"></i> Compress PDF');
                } else {
                    btnCompress.disabled = false;
                }
                showToast(e.message || 'Compression failed.', 'error');
            } finally {
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2500);
            }
        });
    }

    // 5. Merge Multiple PDFs with Sequence Preservation (Requirement 2)
    const btnMerge = document.getElementById('btn-merge-docs') || document.getElementById('btn-merge-pdf');
    if (btnMerge) {
        btnMerge.addEventListener('click', async () => {
            if (selectedMergeFiles.length < 2) {
                return showToast('Please select at least 2 PDF documents to merge.', 'warning');
            }

            const mergeProgress = document.getElementById('merge-progress-wrapper');
            const mergeStatus = document.getElementById('merge-progress-status');
            const mergePercent = document.getElementById('merge-progress-percent');
            const mergeFill = document.getElementById('merge-progress-fill');

            if (mergeProgress) mergeProgress.classList.remove('hidden');
            if (mergePercent) mergePercent.textContent = '20%';
            if (mergeFill) mergeFill.style.width = '20%';
            if (mergeStatus) mergeStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading selected PDFs in sequence...';

            if (typeof DocholderUI !== 'undefined') {
                DocholderUI.setButtonState(btnMerge, 'loading', 'Merging PDFs...');
            } else {
                btnMerge.disabled = true;
            }

            let mTimer = setInterval(() => {
                if (mergePercent && mergeFill && mergeStatus) {
                    let cur = parseInt(mergePercent.textContent || '20', 10);
                    if (cur < 85) {
                        cur += 20;
                        mergePercent.textContent = `${cur}%`;
                        mergeFill.style.width = `${cur}%`;
                        if (cur >= 40 && cur < 70) mergeStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Combining pages in exact order...';
                        if (cur >= 70) mergeStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Building merged document tree...';
                    }
                }
            }, 300);

            try {
                const customName = document.getElementById('merge-custom-name')?.value || '';
                const orderedIds = selectedMergeFiles.map(f => f.id);
                const res = await apiFetch('/api/pdf/merge', {
                    method: 'POST',
                    body: { fileIds: orderedIds, customName }
                });

                clearInterval(mTimer);
                if (mergePercent) mergePercent.textContent = '100%';
                if (mergeFill) mergeFill.style.width = '100%';
                if (mergeStatus) mergeStatus.textContent = 'Merged successfully ✓';

                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnMerge, 'ready', '<i class="fa-solid fa-object-group"></i> Merge PDFs');
                } else {
                    btnMerge.disabled = false;
                }

                showToast('PDFs merged successfully!', 'success');
                displayDocResult(res.result, 'PDFs Merged Successfully');
            } catch(e) {
                clearInterval(mTimer);
                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnMerge, 'ready', '<i class="fa-solid fa-object-group"></i> Merge PDFs');
                } else {
                    btnMerge.disabled = false;
                }
                showToast(e.message || 'Merge failed.', 'error');
            } finally {
                setTimeout(() => {
                    if (mergeProgress) mergeProgress.classList.add('hidden');
                }, 2500);
            }
        });
    }

    // 6. Split
    const btnSplit = document.getElementById('btn-split-doc');
    if (btnSplit) {
        btnSplit.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const fromPage = parseInt(document.getElementById('split-from-page')?.value || '1', 10);
            const toPage = parseInt(document.getElementById('split-to-page')?.value || '1', 10);

            showOperationLoader({
                title: 'Splitting PDF',
                subtitle: `Extracting pages ${fromPage} to ${toPage}...`,
                stages: ['Reading PDF pages...', 'Extracting range...', 'Saving split document...']
            });

            try {
                const res = await apiFetch('/api/pdf/split', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, fromPage, toPage }
                });
                hideOperationLoader();
                showToast('PDF split successfully!', 'success');
                displayDocResult(res.result, 'PDF Split Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Split failed.', 'error');
            }
        });
    }

    // 7. Extract Pages
    const btnExtract = document.getElementById('btn-extract-pages');
    if (btnExtract) {
        btnExtract.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const pages = (document.getElementById('extract-pages-input')?.value || '1').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            if (pages.length === 0) return showToast('Please enter valid page numbers.', 'warning');

            showOperationLoader({
                title: 'Extracting Pages',
                subtitle: `Extracting ${pages.length} pages...`,
                stages: ['Locating target pages...', 'Copying page objects...', 'Generating output file...']
            });

            try {
                const res = await apiFetch('/api/pdf/extract-pages', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, pages }
                });
                hideOperationLoader();
                showToast('Pages extracted successfully!', 'success');
                displayDocResult(res.result, 'Pages Extracted Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Extraction failed.', 'error');
            }
        });
    }

    // 8. Remove Pages
    const btnRemove = document.getElementById('btn-remove-pages');
    if (btnRemove) {
        btnRemove.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const pages = (document.getElementById('remove-pages-input')?.value || '1').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            if (pages.length === 0) return showToast('Please enter page numbers to delete.', 'warning');

            showOperationLoader({
                title: 'Removing Pages',
                subtitle: `Removing ${pages.length} pages...`,
                stages: ['Filtering pages...', 'Rebuilding PDF byte stream...', 'Saving clean document...']
            });

            try {
                const res = await apiFetch('/api/pdf/remove-pages', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, pages }
                });
                hideOperationLoader();
                showToast('Pages removed successfully!', 'success');
                displayDocResult(res.result, 'Pages Removed Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Page removal failed.', 'error');
            }
        });
    }

    // 9. Rotate
    const btnRotate = document.getElementById('btn-rotate-doc');
    if (btnRotate) {
        btnRotate.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const degrees = parseInt(document.getElementById('rotate-degrees')?.value || '90', 10);

            showOperationLoader({
                title: 'Rotating PDF',
                subtitle: `Applying ${degrees}° rotation...`,
                stages: ['Inspecting orientation...', 'Rotating page matrices...', 'Saving rotated PDF...']
            });

            try {
                const res = await apiFetch('/api/pdf/rotate', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, degrees }
                });
                hideOperationLoader();
                showToast(`PDF rotated by ${degrees}°!`, 'success');
                displayDocResult(res.result, 'PDF Rotated Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Rotation failed.', 'error');
            }
        });
    }

    // 10. Watermark
    const btnWatermark = document.getElementById('btn-watermark-doc');
    if (btnWatermark) {
        btnWatermark.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const text = document.getElementById('watermark-text')?.value || 'CONFIDENTIAL';
            const opacity = parseFloat(document.getElementById('watermark-opacity')?.value || '0.35');

            showOperationLoader({
                title: 'Applying Watermark',
                subtitle: `Stamping "${text}"...`,
                stages: ['Calculating layout...', 'Embedding angled watermark...', 'Exporting PDF...']
            });

            try {
                const res = await apiFetch('/api/pdf/watermark', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, text, opacity }
                });
                hideOperationLoader();
                showToast('Watermark applied successfully!', 'success');
                displayDocResult(res.result, 'Watermark Applied Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Watermark failed.', 'error');
            }
        });
    }

    // 11. Page Numbers
    const btnPagenum = document.getElementById('btn-pagenum-doc');
    if (btnPagenum) {
        btnPagenum.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');
            const position = document.getElementById('pagenum-position')?.value || 'bottom-center';
            const format = document.getElementById('pagenum-format')?.value || 'Page {n} of {total}';

            showOperationLoader({
                title: 'Adding Page Numbers',
                subtitle: 'Numbering pages...',
                stages: ['Calculating margins...', 'Embedding page counters...', 'Finalizing PDF...']
            });

            try {
                const res = await apiFetch('/api/pdf/page-numbers', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id, position, format }
                });
                hideOperationLoader();
                showToast('Page numbers added successfully!', 'success');
                displayDocResult(res.result, 'Page Numbers Added');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Page numbering failed.', 'error');
            }
        });
    }

    // 12. PDF/A
    const btnPdfA = document.getElementById('btn-pdfa-doc');
    if (btnPdfA) {
        btnPdfA.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select a PDF document first.', 'warning');

            showOperationLoader({
                title: 'Converting to ISO PDF/A',
                subtitle: 'Formatting for long-term legal archiving...',
                stages: ['Validating PDF tags...', 'Embedding PDF/A-1b schema...', 'Exporting archival file...']
            });

            try {
                const res = await apiFetch('/api/pdf/pdfa', {
                    method: 'POST',
                    body: { fileId: currentDocFile.id }
                });
                hideOperationLoader();
                showToast('Converted to ISO PDF/A successfully!', 'success');
                displayDocResult(res.result, 'Converted to PDF/A Standard');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'PDF/A conversion failed.', 'error');
            }
        });
    }

    // 13. Compare
    const btnCompare = document.getElementById('btn-compare-docs');
    if (btnCompare) {
        btnCompare.addEventListener('click', async () => {
            if (!currentDocFile) return showToast('Please select the first PDF.', 'warning');
            const secondId = document.getElementById('doc-compare-select')?.value;
            if (!secondId) return showToast('Please choose a second PDF to compare.', 'warning');

            showOperationLoader({
                title: 'Comparing Documents',
                subtitle: 'Analyzing textual differences...',
                stages: ['Extracting text from document 1...', 'Extracting text from document 2...', 'Computing similarity metrics...']
            });

            try {
                const res = await apiFetch('/api/pdf/compare', {
                    method: 'POST',
                    body: { fileId1: currentDocFile.id, fileId2: secondId }
                });
                hideOperationLoader();
                showToast('PDF comparison complete!', 'success');
                const compBox = document.getElementById('doc-compare-results');
                if (compBox && res.result) {
                    compBox.classList.remove('hidden');
                    compBox.innerHTML = `
                        <div style="background: var(--surface); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border);">
                            <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary); margin-bottom: 4px;">Similarity: ${res.result.similarity}% Match</div>
                            <div>Matched lines: ${res.result.matchedCount} • Additions: ${res.result.additionsCount} • Deletions: ${res.result.deletionsCount}</div>
                        </div>
                    `;
                }
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Comparison failed.', 'error');
            }
        });
    }
}

function displayDocResult(result, title = 'Operation Completed!', noticeText = null) {
    const card = document.getElementById('doc-result-card');
    if (!card) return;
    card.classList.remove('hidden');
    if (window.DocholderAudio) window.DocholderAudio.playSuccess();

    const titleEl = document.getElementById('doc-result-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${title}`;
    }

    const origEl = document.getElementById('doc-res-orig-name');
    const outEl = document.getElementById('doc-res-out-name');
    const sizeBadge = document.getElementById('doc-res-size-badge');
    const savingsBadge = document.getElementById('doc-savings-badge');
    const infoNotice = document.getElementById('doc-info-notice');
    const infoText = document.getElementById('doc-info-notice-text');

    if (origEl) origEl.textContent = currentDocFile ? currentDocFile.original_name : (result.originalName || 'document.pdf');
    if (outEl) outEl.textContent = result.originalName || 'output.pdf';

    const outSize = result.fileSize || result.convertedSize || 0;
    if (sizeBadge) {
        if (result.originalSize && result.convertedSize) {
            sizeBadge.innerHTML = `Original: <strong>${formatBytes(result.originalSize)}</strong> → Output: <strong style="color: var(--success);">${formatBytes(result.convertedSize)}</strong>`;
        } else {
            sizeBadge.textContent = `Output File Size: ${formatBytes(outSize)}`;
        }
    }

    if (savingsBadge) {
        if (result.percentageSaved && result.percentageSaved > 0) {
            savingsBadge.classList.remove('hidden');
            savingsBadge.textContent = `${result.percentageSaved}% Saved`;
        } else {
            savingsBadge.classList.add('hidden');
        }
    }

    if (infoNotice && infoText) {
        if (noticeText) {
            infoNotice.classList.remove('hidden');
            infoText.textContent = noticeText;
        } else {
            infoNotice.classList.add('hidden');
        }
    }

    const prevLink = document.getElementById('doc-preview-link');
    const dlLink = document.getElementById('doc-download-link');

    if (prevLink) {
        prevLink.href = `${result.downloadUrl}?inline=true`;
    }
    if (dlLink) {
        dlLink.href = result.downloadUrl;
        dlLink.download = result.originalName;
        dlLink.onclick = () => {
            if (typeof DocholderStorage !== 'undefined') {
                DocholderStorage.saveFileLocally(result.downloadUrl, result.originalName);
                showToast(`Saved "${result.originalName}" to local device storage`, 'success');
            }
        };
    }

    const shareBtn = document.getElementById('doc-share-btn');
    if (shareBtn) {
        shareBtn.onclick = async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: result.originalName,
                        text: `Check out ${result.originalName} generated with Docholder`,
                        url: window.location.origin + result.downloadUrl
                    });
                } catch(err) {}
            } else {
                navigator.clipboard.writeText(window.location.origin + result.downloadUrl);
                showToast('Download link copied to clipboard!', 'info');
            }
        };
    }

    const anotherBtn = document.getElementById('doc-another-btn');
    if (anotherBtn) {
        anotherBtn.onclick = () => {
            card.classList.add('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }

    if (result && typeof DocholderStorage !== 'undefined') {
        DocholderStorage.addRecentFile(result);
    }

    card.scrollIntoView({ behavior: 'smooth' });
}
