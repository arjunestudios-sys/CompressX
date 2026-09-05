// Docholder Extraction Logic

document.addEventListener('DOMContentLoaded', async () => {
    const fileSelect = document.getElementById('extract-file-select');
    const uploadInput = document.getElementById('extract-upload-input');
    const startBtn = document.getElementById('start-extract-btn');
    const resultCard = document.getElementById('extract-result-card');
    const archiveTitle = document.getElementById('extract-archive-title');
    const fileCount = document.getElementById('extract-file-count');
    const fileListTbody = document.getElementById('extracted-files-list');
    const downloadAllBtn = document.getElementById('download-all-zip-btn');

    // Populate user workspace archives
    try {
        const res = await apiFetch('/api/files?category=archive');
        const archives = res.files || [];

        if (fileSelect) {
            archives.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
                fileSelect.appendChild(opt);
            });

            // Preselect if query param exists
            const urlParams = new URLSearchParams(window.location.search);
            const preselectedId = urlParams.get('id');
            if (preselectedId) {
                fileSelect.value = preselectedId;
            }
        }
    } catch (err) {
        showToast('Failed to load workspace archives', 'error');
    }

    if (startBtn) {
        startBtn.onclick = async () => {
            const selectedFileId = fileSelect.value;
            const hasUpload = uploadInput.files && uploadInput.files.length > 0;

            if (!selectedFileId && !hasUpload) {
                showToast('Please select or upload an archive file to extract.', 'warning');
                return;
            }

            startBtn.disabled = true;
            startBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Extracting Archive...`;
            showToast('Extracting archive...', 'info');

            try {
                let data;
                if (hasUpload) {
                    const formData = new FormData();
                    formData.append('file', uploadInput.files[0]);
                    data = await apiFetch('/api/extract', {
                        method: 'POST',
                        body: formData
                    });
                } else {
                    data = await apiFetch('/api/extract', {
                        method: 'POST',
                        body: { fileId: selectedFileId }
                    });
                }

                showToast('Archive extracted successfully!', 'success');

                if (resultCard) {
                    resultCard.classList.remove('hidden');
                    archiveTitle.textContent = data.archiveName || 'Extracted Archive';
                    fileCount.textContent = `${data.totalFiles} file(s) extracted`;

                    if (downloadAllBtn) {
                        downloadAllBtn.href = data.downloadAllUrl;
                    }

                    if (fileListTbody) {
                        fileListTbody.innerHTML = '';
                        data.files.forEach(f => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <i class="fa-solid fa-file" style="color: var(--primary);"></i>
                                        <span style="font-weight: 600;">${f.name}</span>
                                    </div>
                                </td>
                                <td style="text-align: right;">${formatBytes(f.size)}</td>
                                <td style="text-align: right;">
                                    <a href="${f.downloadUrl}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-download"></i> Get</a>
                                </td>
                            `;
                            fileListTbody.appendChild(tr);
                        });
                    }

                    resultCard.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                showToast(err.message || 'Extraction failed. Archive may be corrupted.', 'error');
            } finally {
                startBtn.disabled = false;
                startBtn.innerHTML = `<i class="fa-solid fa-box-open"></i> Extract Archive`;
            }
        };
    }
});
