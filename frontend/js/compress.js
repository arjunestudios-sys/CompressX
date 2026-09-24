// Docholder Compress Page Logic

document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('compress-files-list');
    const startBtn = document.getElementById('start-compress-btn');
    const resultCard = document.getElementById('compress-result-card');

    let allFiles = [];

    try {
        const res = await apiFetch('/api/files');
        allFiles = res.files || [];

        if (listContainer) {
            if (allFiles.length === 0) {
                listContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No files available in your workspace. <a href="upload.html">Upload some files first</a>.</div>`;
            } else {
                // Check if specific fileId was passed in URL query param
                const urlParams = new URLSearchParams(window.location.search);
                const preselectedId = urlParams.get('id');

                listContainer.innerHTML = allFiles.map(f => {
                    const isChecked = preselectedId && String(f.id) === String(preselectedId) ? 'checked' : '';
                    return `
                        <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; margin-bottom: 6px; background: var(--surface-hover); border-radius: var(--radius-sm); border: 1px solid var(--surface-border); cursor: pointer;">
                            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                                <input type="checkbox" value="${f.id}" class="compress-cb" ${isChecked} style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 0.9rem; font-weight: 600; color: var(--text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${f.original_name}</span>
                            </div>
                            <span style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; margin-left: 12px;">${formatBytes(f.file_size)}</span>
                        </label>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        showToast('Failed to load workspace files', 'error');
    }

    if (startBtn) {
        startBtn.onclick = async () => {
            const checkedBoxes = document.querySelectorAll('.compress-cb:checked');
            const fileIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));

            if (fileIds.length === 0) {
                showToast('Please select at least one document to compress.', 'warning');
                return;
            }

            const formatInput = document.getElementById('archive-format');
            const levelInput = document.getElementById('archive-level');
            const passwordInput = document.getElementById('archive-password');
            const customNameInput = document.getElementById('archive-name');
            const deleteOriginalsInput = document.getElementById('delete-originals');

            const format = formatInput ? formatInput.value : 'zip';
            const level = levelInput ? parseInt(levelInput.value, 10) : 5;
            const password = passwordInput ? passwordInput.value.trim() : '';
            const customName = customNameInput ? customNameInput.value.trim() : '';
            const deleteOriginals = deleteOriginalsInput ? deleteOriginalsInput.checked : false;

            startBtn.disabled = true;
            startBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compressing ${fileIds.length} file(s)...`;
            showToast('Compression started...', 'info');

            try {
                const res = await apiFetch('/api/compress', {
                    method: 'POST',
                    body: {
                        fileIds,
                        format,
                        level,
                        password: password || undefined,
                        customName: customName || undefined,
                        deleteOriginals
                    }
                });

                const result = res.result;
                showToast('Archive created successfully!', 'success');

                if (resultCard) {
                    resultCard.classList.remove('hidden');
                    const nameEl = document.getElementById('res-archive-name');
                    if (nameEl) nameEl.textContent = result.originalName;

                    const origEl = document.getElementById('res-orig-size');
                    if (origEl) origEl.textContent = formatBytes(result.originalSize);

                    const compEl = document.getElementById('res-comp-size');
                    if (compEl) compEl.textContent = formatBytes(result.compressedSize);

                    const savedEl = document.getElementById('res-saved-percent');
                    if (savedEl) savedEl.textContent = `${result.percentageSaved}% Saved`;

                    const downloadBtn = document.getElementById('res-download-btn');
                    if (downloadBtn) {
                        downloadBtn.href = result.downloadUrl;
                        downloadBtn.onclick = (e) => {
                            e.preventDefault();
                            DocholderStorage.saveFileLocally(result.downloadUrl, result.originalName || 'compressed_file');
                        };
                    }

                    resultCard.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                showToast(err.message || 'Compression failed. Please try again.', 'error');
            } finally {
                startBtn.disabled = false;
                startBtn.innerHTML = `<i class="fa-solid fa-file-zipper"></i> Compress Selected Files`;
            }
        };
    }
});
