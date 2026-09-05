document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('id');

    if (!fileId) {
        showToast("No file ID provided.", "warning");
        setTimeout(() => { window.location.href = 'files.html'; }, 1000);
        return;
    }

    const titleEl = document.getElementById('docx-filename');
    const container = document.getElementById('blocks-container');
    const saveBtn = document.getElementById('save-docx-btn');
    const statsBadge = document.getElementById('docx-stats-badge');
    const findBar = document.getElementById('find-replace-bar');
    const btnToggleFind = document.getElementById('btn-toggle-find');
    const btnCloseFind = document.getElementById('btn-close-find');
    const btnExecReplace = document.getElementById('btn-exec-replace');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportTxt = document.getElementById('btn-export-txt');
    
    let originalBlocks = [];
    let currentDocxFile = null;

    try {
        // Fetch file info
        const fileRes = await apiFetch(`/api/files/${fileId}`);
        currentDocxFile = fileRes.file;
        titleEl.textContent = 'Editing: ' + currentDocxFile.original_name;

        // Fetch text blocks
        const res = await apiFetch(`/api/docx/${fileId}/extract`);
        originalBlocks = res.blocks || [];
        renderBlocks();
    } catch(e) {
        showToast(e.message || "Failed to load DOCX document.", "error");
        setTimeout(() => { window.location.href = 'files.html'; }, 1500);
    }

    function renderBlocks() {
        container.innerHTML = '';
        let hasEditableText = false;
        let totalWords = 0;
        let visibleCount = 0;

        originalBlocks.forEach(block => {
            if (block.text && block.text.trim().length > 0) {
                hasEditableText = true;
                visibleCount++;
                totalWords += block.text.split(/\s+/).filter(Boolean).length;
                
                const div = document.createElement('div');
                div.className = 'text-block';
                div.dataset.id = block.id;
                
                const idLabel = document.createElement('div');
                idLabel.className = 'text-block-id';
                idLabel.innerHTML = `
                    <span>Block #${block.id}</span>
                    <span class="block-char-count">${block.text.length} chars</span>
                `;
                
                const textarea = document.createElement('textarea');
                textarea.value = block.text;
                textarea.dataset.original = block.text;
                
                setTimeout(() => {
                    textarea.style.height = 'auto';
                    textarea.style.height = textarea.scrollHeight + 'px';
                }, 0);
                
                textarea.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = this.scrollHeight + 'px';
                    const charCountSpan = div.querySelector('.block-char-count');
                    if (charCountSpan) charCountSpan.textContent = `${this.value.length} chars`;
                });

                div.appendChild(idLabel);
                div.appendChild(textarea);
                container.appendChild(div);
            }
        });

        if (statsBadge) {
            statsBadge.textContent = `${visibleCount} text blocks • ~${totalWords} words`;
        }

        if (!hasEditableText) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding: 30px;">No editable text segments found in this document.</p>';
        }
    }

    // Toggle Find & Replace
    if (btnToggleFind && findBar) {
        btnToggleFind.addEventListener('click', () => {
            findBar.classList.toggle('hidden');
            if (!findBar.classList.contains('hidden')) {
                document.getElementById('find-query')?.focus();
            }
        });
    }

    if (btnCloseFind && findBar) {
        btnCloseFind.addEventListener('click', () => findBar.classList.add('hidden'));
    }

    // Execute Find & Replace
    if (btnExecReplace) {
        btnExecReplace.addEventListener('click', () => {
            const findText = document.getElementById('find-query')?.value || '';
            const replaceText = document.getElementById('replace-query')?.value || '';

            if (!findText) {
                return showToast('Please enter text to find.', 'warning');
            }

            const textareas = container.querySelectorAll('textarea');
            let replaceCount = 0;

            textareas.forEach(ta => {
                if (ta.value.includes(findText)) {
                    const count = ta.value.split(findText).length - 1;
                    replaceCount += count;
                    ta.value = ta.value.replaceAll(findText, replaceText);
                    ta.dispatchEvent(new Event('input'));
                }
            });

            if (replaceCount > 0) {
                showToast(`Replaced ${replaceCount} occurrences! Click "Save DOCX" to commit.`, 'success');
            } else {
                showToast(`No matches found for "${findText}".`, 'info');
            }
        });
    }

    // Export PDF directly
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', async () => {
            if (!currentDocxFile) return;
            showOperationLoader({
                title: 'Exporting to PDF',
                subtitle: `Converting ${currentDocxFile.original_name}...`,
                stages: ['Reading document paragraphs...', 'Generating vector layout...', 'Compiling PDF document...']
            });

            try {
                const res = await apiFetch('/api/convert/document', {
                    method: 'POST',
                    body: { fileId: currentDocxFile.id, format: 'pdf' }
                });
                hideOperationLoader();
                showToast('Exported to PDF successfully!', 'success', 5000, {
                    text: 'Download',
                    onClick: () => window.open(res.result.downloadUrl, '_blank')
                });
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'PDF export failed.', 'error');
            }
        });
    }

    // Export TXT directly
    if (btnExportTxt) {
        btnExportTxt.addEventListener('click', async () => {
            if (!currentDocxFile) return;
            showOperationLoader({
                title: 'Exporting to Plain Text',
                subtitle: `Converting ${currentDocxFile.original_name}...`,
                stages: ['Extracting raw text runs...', 'Saving plain text document...']
            });

            try {
                const res = await apiFetch('/api/convert/document', {
                    method: 'POST',
                    body: { fileId: currentDocxFile.id, format: 'txt' }
                });
                hideOperationLoader();
                showToast('Exported to TXT successfully!', 'success', 5000, {
                    text: 'Download',
                    onClick: () => window.open(res.result.downloadUrl, '_blank')
                });
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'TXT export failed.', 'error');
            }
        });
    }

    // Save DOCX
    saveBtn.addEventListener('click', async () => {
        const textareas = container.querySelectorAll('textarea');
        const updatedBlocks = [];
        let hasChanges = false;

        textareas.forEach(ta => {
            if (ta.value !== ta.dataset.original) {
                updatedBlocks.push({
                    id: parseInt(ta.parentElement.dataset.id, 10),
                    text: ta.value
                });
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            showToast('No modifications detected.', 'info');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            await apiFetch(`/api/docx/${fileId}/update`, {
                method: 'PUT',
                body: { blocks: updatedBlocks }
            });
            showToast('DOCX saved successfully with structure preserved!', 'success');
            setTimeout(() => { window.location.href = 'files.html'; }, 1200);
        } catch(e) {
            showToast(e.message || 'Failed to save document.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save DOCX';
        }
    });
});
