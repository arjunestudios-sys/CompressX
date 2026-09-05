// Docholder Upload Logic

document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const uploadStatus = document.getElementById('upload-status');
    const successCard = document.getElementById('upload-success-card');
    const successDetails = document.getElementById('upload-success-details');
    const transformBtn = document.getElementById('btn-transform-now');
    const anotherBtn = document.getElementById('btn-upload-another');

    if (!dropzone || !fileInput) return;

    dropzone.onclick = () => fileInput.click();

    dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    };

    dropzone.ondragleave = () => {
        dropzone.classList.remove('drag-over');
    };

    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files[0]);
        }
    };

    fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
            handleUpload(fileInput.files[0]);
        }
    };

    if (anotherBtn) {
        anotherBtn.onclick = () => {
            successCard.classList.add('hidden');
            progressContainer.classList.add('hidden');
            progressFill.style.width = '0%';
            fileInput.value = '';
        };
    }

    function handleUpload(file) {
        if (file.size > 200 * 1024 * 1024) {
            showToast('File size exceeds 200MB limit.', 'error');
            return;
        }

        progressContainer.classList.remove('hidden');
        successCard.classList.add('hidden');
        progressFill.style.width = '0%';
        uploadStatus.textContent = 'Uploading... 0%';

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/files/upload', true);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = `${percent}%`;
                uploadStatus.textContent = `Uploading... ${percent}%`;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 201) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    const uploaded = data.file;
                    uploadStatus.textContent = 'Uploaded 100% ✓';
                    showToast('Document uploaded successfully!', 'success');

                    successCard.classList.remove('hidden');
                    successDetails.innerHTML = `
                        <div><strong>Document:</strong> ${uploaded.original_name}</div>
                        <div><strong>Category:</strong> ${uploaded.file_type.toUpperCase()} • <strong>Size:</strong> ${formatBytes(uploaded.file_size)}</div>
                    `;

                    if (transformBtn) {
                        transformBtn.href = `convert.html?fileId=${uploaded.id}`;
                    }
                    successCard.scrollIntoView({ behavior: 'smooth' });
                } catch(e) {
                    showToast('Error parsing server response', 'error');
                }
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    showToast(err.error || 'Upload failed', 'error');
                } catch(e) {
                    showToast('Upload failed. Please try again.', 'error');
                }
            }
        };

        xhr.onerror = () => {
            showToast('Network error during upload', 'error');
        };

        xhr.send(formData);
    }
});
