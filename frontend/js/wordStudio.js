/**
 * Docholder Word Studio Client Controller
 * Native Word document editing, layout options, optimization, and universal conversions
 */

let currentWordFile = null;
let workspaceWordDocs = [];
let documentBlocks = []; // Array of { id, text, heading, bold, italic }
let undoStack = [];
let redoStack = [];
let activeMode = 'convert'; // 'convert', 'optimize', 'edit'
let selectedOptLevel = 'recommended';

document.addEventListener('DOMContentLoaded', async () => {
    setupModeChips();
    setupDropzone();
    setupConversionControls();
    setupOptimizationControls();
    setupEditorToolbar();
    await loadWorkspaceWordDocs();

    const params = new URLSearchParams(window.location.search);
    const initialFileId = params.get('fileId');
    const initialMode = params.get('mode') || 'convert';

    if (['convert', 'optimize', 'edit'].includes(initialMode)) {
        switchMode(initialMode);
    }

    if (initialFileId) {
        const sel = document.getElementById('word-file-select');
        if (sel) {
            sel.value = initialFileId;
            sel.dispatchEvent(new Event('change'));
        }
    }
});

function setupModeChips() {
    document.querySelectorAll('#word-mode-selector .action-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const mode = chip.getAttribute('data-mode');
            if (mode) switchMode(mode);
        });
    });
}

function switchMode(mode) {
    activeMode = mode;
    const panels = ['convert', 'optimize', 'edit'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-word-${p}`);
        if (el) el.classList.toggle('hidden', p !== mode);
    });

    document.querySelectorAll('#word-mode-selector .action-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-mode') === mode);
    });

    const title = document.getElementById('word-page-title');
    const subtitle = document.getElementById('word-page-subtitle');
    const headerTitle = document.getElementById('word-studio-header-title');

    if (mode === 'convert') {
        if (title) title.innerHTML = '<i class="fa-solid fa-rotate" style="color: var(--magenta-neon);"></i> Convert Word Document';
        if (subtitle) subtitle.textContent = 'Transform Word documents with custom page sizes, margins, typography, and watermarks.';
        if (headerTitle) headerTitle.textContent = 'Word Convert';
    } else if (mode === 'optimize') {
        if (title) title.innerHTML = '<i class="fa-solid fa-bolt" style="color: var(--amber-neon);"></i> Optimize Word Document';
        if (subtitle) subtitle.textContent = 'Compress embedded media and clean bloated XML structures to reduce DOCX file size.';
        if (headerTitle) headerTitle.textContent = 'Word Optimizer';
    } else if (mode === 'edit') {
        if (title) title.innerHTML = '<i class="fa-solid fa-file-word" style="color: #3B82F6;"></i> Edit Word Document';
        if (subtitle) subtitle.textContent = 'Modify paragraph text, format typography, and save locally.';
        if (headerTitle) headerTitle.textContent = 'Word Editor';
        if (currentWordFile && documentBlocks.length === 0) {
            loadDocumentContent(currentWordFile.id);
        }
    }

    if (window.DocholderAudio) window.DocholderAudio.playWarp();
}

async function loadWorkspaceWordDocs() {
    try {
        const data = await apiFetch('/api/files');
        const allFiles = data.files || [];
        workspaceWordDocs = allFiles.filter(f => {
            const name = (f.original_name || '').toLowerCase();
            return name.endsWith('.docx') || name.endsWith('.doc') || 
                   f.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   f.mime_type === 'application/msword';
        });

        const select = document.getElementById('word-file-select');
        if (!select) return;

        select.innerHTML = '<option value="">-- Choose from Workspace --</option>';
        workspaceWordDocs.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
            select.appendChild(opt);
        });

        select.addEventListener('change', async (e) => {
            const fId = e.target.value;
            currentWordFile = workspaceWordDocs.find(f => String(f.id) === String(fId)) || null;
            updateSelectedWordBadge(currentWordFile);
            if (currentWordFile) {
                if (activeMode === 'edit') {
                    await loadDocumentContent(currentWordFile.id);
                }
            }
        });
    } catch(e) {
        console.warn('Failed to load workspace Word docs:', e);
    }
}

function updateSelectedWordBadge(file) {
    const badge = document.getElementById('selected-word-badge');
    const nameEl = document.getElementById('selected-word-name');
    const sizeEl = document.getElementById('selected-word-size');
    const btnConvert = document.getElementById('btn-apply-word-convert');
    const btnOpt = document.getElementById('btn-apply-word-optimize');

    if (!badge) return;

    if (file) {
        badge.classList.remove('hidden');
        if (nameEl) nameEl.textContent = file.original_name;
        if (sizeEl) sizeEl.textContent = formatBytes(file.file_size);
        if (btnConvert && typeof DocholderUI !== 'undefined') {
            DocholderUI.setButtonState(btnConvert, 'ready', '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert Word Document');
        }
        if (btnOpt && typeof DocholderUI !== 'undefined') {
            DocholderUI.setButtonState(btnOpt, 'ready', '<i class="fa-solid fa-bolt"></i> Optimize DOCX Package');
        }
    } else {
        badge.classList.add('hidden');
        if (btnConvert && typeof DocholderUI !== 'undefined') {
            DocholderUI.setButtonState(btnConvert, 'disabled', '<i class="fa-solid fa-wand-magic-sparkles"></i> Select Word File First');
        }
        if (btnOpt && typeof DocholderUI !== 'undefined') {
            DocholderUI.setButtonState(btnOpt, 'disabled', '<i class="fa-solid fa-bolt"></i> Select Word File First');
        }
    }
}

function setupDropzone() {
    const dropzone = document.getElementById('word-dropzone');
    const fileInput = document.getElementById('word-file-input');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await uploadWordDirect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await uploadWordDirect(e.target.files[0]);
        }
    });
}

async function uploadWordDirect(file) {
    if (!file.name.match(/\.(docx|doc)$/i)) {
        return showToast('Please select a valid Word document (.docx or .doc)', 'warning');
    }

    const dropzone = document.getElementById('word-dropzone');
    const tracker = typeof renderFileUploadTracker === 'function' ? renderFileUploadTracker(dropzone, file) : null;
    const btnConvert = document.getElementById('btn-apply-word-convert');
    if (btnConvert && typeof DocholderUI !== 'undefined') {
        DocholderUI.setButtonState(btnConvert, 'disabled', '<i class="fa-solid fa-spinner fa-spin"></i> Uploading Word File...');
    }

    try {
        if (tracker) tracker.update(25, 'Loading document... 25%', 'Est: ~1s');
        await new Promise(r => setTimeout(r, 80));

        if (tracker) tracker.update(60, 'Reading file contents... 60%', 'Est: ~1s');

        const res = await uploadFileWithProgress('/api/files/upload', file, (p) => {
            if (tracker && p.percent) {
                const scaled = Math.min(88, Math.max(25, Math.round(p.percent * 0.88)));
                tracker.update(scaled, `Reading file contents... ${scaled}%`);
            }
        });

        if (tracker) tracker.update(95, 'Preparing document... 95%');
        await new Promise(r => setTimeout(r, 60));

        if (tracker) tracker.ready(file.name);
        showToast('Word document loaded successfully!', 'success');
        await loadWorkspaceWordDocs();

        currentWordFile = res.file;
        const sel = document.getElementById('word-file-select');
        if (sel) sel.value = res.file.id;
        updateSelectedWordBadge(currentWordFile);

        if (activeMode === 'edit') {
            await loadDocumentContent(res.file.id);
        }
    } catch(e) {
        if (tracker) tracker.error(e.message || 'Upload failed');
        showToast(e.message || 'Upload failed.', 'error');
    }
}

function setupConversionControls() {
    const btnConvert = document.getElementById('btn-apply-word-convert');
    const targetSelect = document.getElementById('word-convert-target');
    const pdfOptsBox = document.getElementById('word-pdf-options-box');

    if (targetSelect && pdfOptsBox) {
        targetSelect.addEventListener('change', (e) => {
            pdfOptsBox.classList.toggle('hidden', e.target.value !== 'pdf');
        });
    }

    if (btnConvert) {
        btnConvert.addEventListener('click', async () => {
            if (!currentWordFile) {
                return showToast('Please select or upload a Word document first.', 'warning');
            }

            const targetFormat = document.getElementById('word-convert-target')?.value || 'pdf';
            const pageSize = document.getElementById('word-opt-pagesize')?.value || 'A4';
            const margins = document.getElementById('word-opt-margins')?.value || 'standard';
            const theme = document.getElementById('word-opt-theme')?.value || 'modern';
            const watermark = document.getElementById('word-opt-watermark')?.value || 'none';
            const pageNumbers = document.getElementById('word-opt-pagenums')?.checked !== false;

            const progressWrapper = document.getElementById('word-convert-progress-wrapper');
            const progressFill = document.getElementById('word-convert-progress-fill');
            const progressStatus = document.getElementById('word-convert-progress-status');
            const progressPercent = document.getElementById('word-convert-progress-percent');
            const errContainer = document.getElementById('word-error-container');
            if (errContainer) errContainer.innerHTML = '';

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '25%';
            if (progressPercent) progressPercent.textContent = '25%';
            if (progressStatus) progressStatus.textContent = `Reading ${currentWordFile.original_name}...`;

            if (typeof DocholderUI !== 'undefined') {
                DocholderUI.setButtonState(btnConvert, 'loading', `Converting to ${targetFormat.toUpperCase()}...`);
            }

            try {
                if (progressFill) progressFill.style.width = '60%';
                if (progressPercent) progressPercent.textContent = '60%';
                if (progressStatus) progressStatus.textContent = `Rendering .${targetFormat} with ${theme} theme & ${pageSize} format...`;

                const res = await apiFetch('/api/convert/document', {
                    method: 'POST',
                    body: {
                        fileId: currentWordFile.id,
                        format: targetFormat,
                        pageSize,
                        margins,
                        theme,
                        watermark,
                        pageNumbers
                    }
                });

                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'Conversion Completed ✓';

                showToast(`Converted to ${targetFormat.toUpperCase()} successfully!`, 'success');
                if (window.DocholderAudio) window.DocholderAudio.playSuccess();

                if (res.result) {
                    displayWordResult({
                        id: res.result.id,
                        title: `Converted to ${targetFormat.toUpperCase()}`,
                        originalName: res.result.originalName,
                        fileSize: res.result.convertedSize,
                        downloadUrl: res.result.downloadUrl
                    });
                }

                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnConvert, 'ready', '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert Again');
                }
            } catch(e) {
                if (progressStatus) progressStatus.textContent = 'Conversion encountered an issue.';
                showToast(e.message || 'Word conversion failed.', 'error');
                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnConvert, 'ready', '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert Word Document');
                }

                if (errContainer && typeof DocholderUI !== 'undefined') {
                    DocholderUI.renderErrorCard(errContainer, e.message || "We couldn't convert this file. Please try again or select another file.", () => {
                        btnConvert.click();
                    });
                }
            } finally {
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2500);
            }
        });
    }

    setupResultCardActions();
}

function setupOptimizationControls() {
    document.querySelectorAll('.word-opt-level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.word-opt-level-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = '';
                b.style.color = '';
            });
            btn.classList.add('active');
            btn.style.borderColor = 'var(--amber-neon)';
            btn.style.color = 'var(--amber-neon)';
            selectedOptLevel = btn.getAttribute('data-level') || 'recommended';
        });
    });

    const btnOpt = document.getElementById('btn-apply-word-optimize');
    if (btnOpt) {
        btnOpt.addEventListener('click', async () => {
            if (!currentWordFile) {
                return showToast('Please select or upload a Word document first.', 'warning');
            }

            const progressWrapper = document.getElementById('word-opt-progress-wrapper');
            const progressFill = document.getElementById('word-opt-progress-fill');
            const progressStatus = document.getElementById('word-opt-progress-status');
            const progressPercent = document.getElementById('word-opt-progress-percent');

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '30%';
            if (progressPercent) progressPercent.textContent = '30%';
            if (progressStatus) progressStatus.textContent = 'Inspecting embedded images and XML tree...';

            if (typeof DocholderUI !== 'undefined') {
                DocholderUI.setButtonState(btnOpt, 'loading', 'Optimizing Word Document...');
            }

            try {
                if (progressFill) progressFill.style.width = '70%';
                if (progressPercent) progressPercent.textContent = '70%';
                if (progressStatus) progressStatus.textContent = 'Compressing media streams and stripping XML bloat...';

                const res = await apiFetch(`/api/docx/${currentWordFile.id}/optimize`, {
                    method: 'POST',
                    body: { level: selectedOptLevel }
                });

                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'Optimization Complete ✓';

                showToast(res.message || 'Word document optimized!', 'success');
                if (window.DocholderAudio) window.DocholderAudio.playSuccess();

                if (res.result) {
                    displayWordResult({
                        id: res.result.id,
                        title: `Optimized Word Document (${res.result.percentageSaved}% Saved)`,
                        originalName: res.result.originalName,
                        fileSize: res.result.compressedSize,
                        downloadUrl: res.result.downloadUrl
                    });
                }

                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnOpt, 'ready', '<i class="fa-solid fa-bolt"></i> Optimize DOCX Package');
                }
            } catch(e) {
                showToast(e.message || 'Optimization failed.', 'error');
                if (typeof DocholderUI !== 'undefined') {
                    DocholderUI.setButtonState(btnOpt, 'ready', '<i class="fa-solid fa-bolt"></i> Optimize DOCX Package');
                }
            } finally {
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2500);
            }
        });
    }
}

async function loadDocumentContent(fileId) {
    const container = document.getElementById('word-blocks-container');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 36px; color: var(--text-secondary);">
            <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--cyan-neon); margin-bottom: 8px; display: block;"></i>
            Extracting document text segments...
        </div>
    `;

    try {
        const res = await apiFetch(`/api/docx/${fileId}/extract`);
        const rawBlocks = res.blocks || [];

        documentBlocks = rawBlocks.map((b, idx) => ({
            id: b.id !== undefined ? b.id : idx,
            text: b.text || '',
            heading: 0,
            bold: false,
            italic: false
        })).filter(b => b.text.trim().length > 0);

        if (documentBlocks.length === 0) {
            documentBlocks = [{ id: 0, text: 'Type your document content here...', heading: 0, bold: false, italic: false }];
        }

        undoStack = [];
        redoStack = [];
        renderBlocks();
        updateWordStats();
    } catch(e) {
        documentBlocks = [{ id: 0, text: '', heading: 0, bold: false, italic: false }];
        renderBlocks();
    }
}

function snapshotState() {
    undoStack.push(JSON.stringify(documentBlocks));
    if (undoStack.length > 30) undoStack.shift();
    redoStack = [];
}

function renderBlocks() {
    const container = document.getElementById('word-blocks-container');
    if (!container) return;

    if (documentBlocks.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: var(--text-secondary);">
                <p>Document is empty. Click <strong>Add Paragraph</strong> to begin.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    documentBlocks.forEach((block, index) => {
        const card = document.createElement('div');
        card.className = 'word-block-card';

        const headingLabel = block.heading === 1 ? 'Heading 1' : (block.heading === 2 ? 'Heading 2' : (block.heading === 3 ? 'Heading 3' : `¶ Paragraph ${index + 1}`));

        card.innerHTML = `
            <div class="word-block-header">
                <span style="font-weight: 700; color: var(--text);">${headingLabel}</span>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <select class="form-select" data-action="change-heading" data-index="${index}" style="font-size: 0.7rem; padding: 2px 4px; width: auto; height: 26px;">
                        <option value="0" ${block.heading === 0 ? 'selected' : ''}>Body Text</option>
                        <option value="1" ${block.heading === 1 ? 'selected' : ''}>Heading 1</option>
                        <option value="2" ${block.heading === 2 ? 'selected' : ''}>Heading 2</option>
                        <option value="3" ${block.heading === 3 ? 'selected' : ''}>Heading 3</option>
                    </select>
                    <button type="button" class="btn btn-secondary btn-sm word-toolbar-btn" data-action="move-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-up"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm word-toolbar-btn" data-action="move-down" data-index="${index}" title="Move Down" ${index === documentBlocks.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm word-toolbar-btn" data-action="toggle-bold" data-index="${index}" title="Bold" style="${block.bold ? 'color: var(--cyan-neon); border-color: var(--cyan-neon);' : ''}">
                        <i class="fa-solid fa-bold"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm word-toolbar-btn" data-action="toggle-italic" data-index="${index}" title="Italic" style="${block.italic ? 'color: var(--cyan-neon); border-color: var(--cyan-neon);' : ''}">
                        <i class="fa-solid fa-italic"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm word-toolbar-btn" data-action="delete" data-index="${index}" title="Delete Paragraph" style="color: var(--danger);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <textarea class="word-block-textarea" data-index="${index}" style="${block.bold ? 'font-weight: bold;' : ''} ${block.italic ? 'font-style: italic;' : ''} ${block.heading === 1 ? 'font-size: 1.15rem; font-weight: 700;' : (block.heading === 2 ? 'font-size: 1rem; font-weight: 600;' : '')}">${block.text}</textarea>
        `;

        const textarea = card.querySelector('textarea');
        textarea.addEventListener('input', (e) => {
            snapshotState();
            documentBlocks[index].text = e.target.value;
            updateWordStats();
        });

        card.querySelector('[data-action="change-heading"]').addEventListener('change', (e) => {
            snapshotState();
            documentBlocks[index].heading = parseInt(e.target.value, 10);
            renderBlocks();
        });

        card.querySelector('[data-action="move-up"]')?.addEventListener('click', () => {
            if (index > 0) {
                snapshotState();
                const temp = documentBlocks[index];
                documentBlocks[index] = documentBlocks[index - 1];
                documentBlocks[index - 1] = temp;
                renderBlocks();
            }
        });

        card.querySelector('[data-action="move-down"]')?.addEventListener('click', () => {
            if (index < documentBlocks.length - 1) {
                snapshotState();
                const temp = documentBlocks[index];
                documentBlocks[index] = documentBlocks[index + 1];
                documentBlocks[index + 1] = temp;
                renderBlocks();
            }
        });

        card.querySelector('[data-action="toggle-bold"]').addEventListener('click', () => {
            snapshotState();
            documentBlocks[index].bold = !documentBlocks[index].bold;
            renderBlocks();
        });

        card.querySelector('[data-action="toggle-italic"]').addEventListener('click', () => {
            snapshotState();
            documentBlocks[index].italic = !documentBlocks[index].italic;
            renderBlocks();
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (documentBlocks.length <= 1) {
                documentBlocks[0].text = '';
                renderBlocks();
                return;
            }
            snapshotState();
            documentBlocks.splice(index, 1);
            renderBlocks();
            updateWordStats();
            showToast(`Paragraph ${index + 1} deleted`, 'info', 1200);
        });

        container.appendChild(card);
    });
}

function updateWordStats() {
    const statsBadge = document.getElementById('word-stats-badge');
    if (!statsBadge) return;

    let totalWords = 0;
    let totalChars = 0;

    documentBlocks.forEach(b => {
        const text = (b.text || '').trim();
        if (text) {
            totalWords += text.split(/\s+/).filter(Boolean).length;
            totalChars += text.length;
        }
    });

    statsBadge.textContent = `${totalWords} words • ${documentBlocks.length} paragraphs • ${totalChars} chars`;
}

function setupEditorToolbar() {
    // Undo
    document.getElementById('btn-word-undo')?.addEventListener('click', () => {
        if (undoStack.length === 0) return showToast('Nothing to undo', 'info', 1200);
        redoStack.push(JSON.stringify(documentBlocks));
        documentBlocks = JSON.parse(undoStack.pop());
        renderBlocks();
        updateWordStats();
        showToast('Undo', 'info', 800);
    });

    // Redo
    document.getElementById('btn-word-redo')?.addEventListener('click', () => {
        if (redoStack.length === 0) return showToast('Nothing to redo', 'info', 1200);
        undoStack.push(JSON.stringify(documentBlocks));
        documentBlocks = JSON.parse(redoStack.pop());
        renderBlocks();
        updateWordStats();
        showToast('Redo', 'info', 800);
    });

    // Toggle Find & Replace Bar
    const findBar = document.getElementById('word-find-replace-bar');
    document.getElementById('btn-toggle-find')?.addEventListener('click', () => {
        if (findBar) findBar.classList.toggle('hidden');
    });

    document.getElementById('btn-close-word-find')?.addEventListener('click', () => {
        if (findBar) findBar.classList.add('hidden');
    });

    document.getElementById('btn-exec-word-replace')?.addEventListener('click', () => {
        const findVal = document.getElementById('word-find-input')?.value;
        const replaceVal = document.getElementById('word-replace-input')?.value || '';

        if (!findVal) return showToast('Please enter text to find.', 'warning');

        snapshotState();
        let replaceCount = 0;

        documentBlocks.forEach(b => {
            if (b.text && b.text.includes(findVal)) {
                const parts = b.text.split(findVal);
                replaceCount += parts.length - 1;
                b.text = parts.join(replaceVal);
            }
        });

        renderBlocks();
        updateWordStats();
        showToast(`Replaced ${replaceCount} occurrences!`, 'success');
    });

    // Add Paragraph
    document.getElementById('btn-add-paragraph')?.addEventListener('click', () => {
        snapshotState();
        documentBlocks.push({
            id: documentBlocks.length,
            text: '',
            heading: 0,
            bold: false,
            italic: false
        });
        renderBlocks();
        updateWordStats();
        setTimeout(() => {
            const textareas = document.querySelectorAll('.word-block-textarea');
            if (textareas.length > 0) textareas[textareas.length - 1].focus();
        }, 100);
    });

    // Save DOCX
    const btnSaveDocx = document.getElementById('btn-save-docx');
    if (btnSaveDocx) {
        btnSaveDocx.addEventListener('click', async () => {
            if (documentBlocks.length === 0 || documentBlocks.every(b => !b.text.trim())) {
                return showToast('Please enter some text in the document before saving.', 'warning');
            }

            btnSaveDocx.disabled = true;
            btnSaveDocx.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                const title = currentWordFile ? currentWordFile.original_name : 'Document';
                const res = await apiFetch('/api/docx/save-new', {
                    method: 'POST',
                    body: {
                        title: title,
                        paragraphs: documentBlocks
                    }
                });

                showToast('Word document saved successfully!', 'success');
                if (window.DocholderAudio) window.DocholderAudio.playSuccess();

                displayWordResult({
                    title: `Saved Word Document`,
                    originalName: res.file ? res.file.original_name : 'document.docx',
                    fileSize: res.file ? res.file.file_size : 0,
                    downloadUrl: res.downloadUrl
                });
            } catch(e) {
                showToast(e.message || 'Failed to save Word document.', 'error');
            } finally {
                btnSaveDocx.disabled = false;
                btnSaveDocx.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save DOCX';
            }
        });
    }
}

function setupResultCardActions() {
    document.getElementById('btn-word-res-preview')?.addEventListener('click', () => {
        const link = document.getElementById('word-download-link');
        if (!link || !link.href || link.href.includes('#')) return;
        openWordPdfPreviewModal(link.href, link.download);
    });

    document.getElementById('btn-word-res-share')?.addEventListener('click', async () => {
        const link = document.getElementById('word-download-link');
        if (!link || !link.href) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: link.download,
                    text: `Converted Document: ${link.download}`,
                    url: link.href
                });
                showToast('Share dialog opened', 'success');
            } catch(e) {}
        } else {
            await navigator.clipboard.writeText(link.href);
            showToast('Download link copied to clipboard!', 'success');
        }
    });

    document.getElementById('btn-word-convert-another')?.addEventListener('click', () => {
        resetWordStudio();
    });

    document.getElementById('close-word-preview-btn')?.addEventListener('click', () => {
        document.getElementById('word-preview-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-modal-save')?.addEventListener('click', () => {
        const link = document.getElementById('word-download-link');
        if (link && link.href) {
            const a = document.createElement('a');
            a.href = link.href;
            a.download = link.download || 'document';
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast('Saved to device storage!', 'success');
        }
    });

    document.getElementById('btn-modal-share')?.addEventListener('click', () => {
        document.getElementById('btn-word-res-share')?.click();
    });
}

function openWordPdfPreviewModal(url, filename) {
    const modal = document.getElementById('word-preview-modal');
    const iframe = document.getElementById('word-preview-iframe');
    const title = document.getElementById('word-preview-modal-title');
    if (!modal || !iframe) return;

    if (title) title.innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${filename || 'Document Preview'}`;
    iframe.src = url + (url.includes('?') ? '&inline=true' : '?inline=true');
    modal.classList.remove('hidden');
}

function resetWordStudio() {
    currentWordFile = null;
    document.getElementById('selected-word-badge')?.classList.add('hidden');
    document.getElementById('word-result-card')?.classList.add('hidden');
    document.getElementById('word-error-container')?.replaceChildren();
    const sel = document.getElementById('word-file-select');
    if (sel) sel.value = '';
    const btnConvert = document.getElementById('btn-apply-word-convert');
    if (btnConvert && typeof DocholderUI !== 'undefined') {
        DocholderUI.setButtonState(btnConvert, 'disabled', '<i class="fa-solid fa-wand-magic-sparkles"></i> Select Word File First');
    }
    showToast('Ready for another document', 'info', 1200);
}

function displayWordResult(result) {
    const card = document.getElementById('word-result-card');
    if (!card) return;

    card.classList.remove('hidden');
    const titleEl = document.getElementById('word-result-title');
    const outNameEl = document.getElementById('word-res-out-name');
    const sizeBadge = document.getElementById('word-res-size-badge');
    const dlLink = document.getElementById('word-download-link');

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.title || 'Operation Completed Successfully'}`;
    if (outNameEl) outNameEl.textContent = result.originalName;
    if (sizeBadge) sizeBadge.textContent = formatBytes(result.fileSize || 0);
    if (dlLink) {
        dlLink.href = result.downloadUrl;
        dlLink.download = result.originalName;
    }

    card.scrollIntoView({ behavior: 'smooth' });
}
