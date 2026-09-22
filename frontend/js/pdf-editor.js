document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('id');

    if (!fileId) {
        showToast("No file ID provided.", "warning");
        setTimeout(() => { window.location.href = 'files.html'; }, 1000);
        return;
    }

    const titleEl = document.getElementById('pdf-filename');
    const container = document.getElementById('pdf-container');
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const overlayLayer = document.getElementById('overlay-layer');
    
    let pdfDoc = null;
    let pageNum = 1;
    let pageIsRendering = false;
    let pageNumPending = null;
    let scale = 1.5;
    
    // Store annotations globally per page
    const annotationsMap = {};

    try {
        // Fetch file info
        const fileRes = await apiFetch(`/api/files/${fileId}`);
        titleEl.textContent = 'Editing: ' + fileRes.file.original_name;

        // Fetch PDF content as ArrayBuffer
        const pdfDownloadUrl = (typeof resolveApiUrl === 'function') ? resolveApiUrl(`/api/files/${fileId}/download?inline=true`) : `/api/files/${fileId}/download?inline=true`;
        const pdfHeaders = {};
        const authToken = localStorage.getItem('docholder_auth_token') || sessionStorage.getItem('docholder_auth_token');
        if (authToken) {
            pdfHeaders['Authorization'] = `Bearer ${authToken}`;
        }
        const pdfDataRes = await fetch(pdfDownloadUrl, {
            credentials: 'include',
            headers: pdfHeaders
        });
        if (!pdfDataRes.ok) throw new Error("Failed to load PDF.");
        
        const pdfBytes = await pdfDataRes.arrayBuffer();

        pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const pageCountEl = document.getElementById('page-count');
        if (pageCountEl) pageCountEl.textContent = pdfDoc.numPages;
        
        renderPage(pageNum);
    } catch(e) {
        showToast(e.message || "Failed to load document.", "error");
        setTimeout(() => { window.location.href = 'files.html'; }, 1500);
    }

    function renderPage(num) {
        pageIsRendering = true;
        
        // Save current annotations on screen to map before switching
        saveCurrentAnnotationsToMap();
        if (overlayLayer) overlayLayer.innerHTML = '';

        pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            container.style.width = viewport.width + 'px';
            container.style.height = viewport.height + 'px';

            const renderCtx = { canvasContext: ctx, viewport: viewport };
            
            page.render(renderCtx).promise.then(() => {
                pageIsRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                } else {
                    restoreAnnotationsFromMap();
                }
            });
        });

        const pageNumEl = document.getElementById('page-num');
        if (pageNumEl) pageNumEl.textContent = num;
    }

    function queueRenderPage(num) {
        if (pageIsRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function updateAnnotationCount() {
        saveCurrentAnnotationsToMap();
        let total = 0;
        Object.values(annotationsMap).forEach(arr => {
            total += arr.length;
        });
        const badgeText = document.getElementById('anno-count-text');
        if (badgeText) {
            badgeText.textContent = `${total} annotation${total === 1 ? '' : 's'}`;
        }
    }

    // Zoom Controls
    const zoomLevelBadge = document.getElementById('zoom-level-badge');
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
        if (scale >= 2.5) return;
        scale = Math.min(2.5, +(scale + 0.25).toFixed(2));
        if (zoomLevelBadge) zoomLevelBadge.textContent = `${Math.round(scale * 100)}%`;
        queueRenderPage(pageNum);
    });

    document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
        if (scale <= 0.75) return;
        scale = Math.max(0.75, +(scale - 0.25).toFixed(2));
        if (zoomLevelBadge) zoomLevelBadge.textContent = `${Math.round(scale * 100)}%`;
        queueRenderPage(pageNum);
    });

    // Clear Annotations Button
    document.getElementById('clear-annotations-btn')?.addEventListener('click', () => {
        if (overlayLayer) overlayLayer.innerHTML = '';
        annotationsMap[pageNum] = [];
        updateAnnotationCount();
        showToast("Cleared annotations on current page", "info");
    });

    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    });

    // --- Annotation Logic ---
    let isAddingText = false;
    const addTextBtn = document.getElementById('add-text-btn');

    addTextBtn?.addEventListener('click', () => {
        isAddingText = !isAddingText;
        addTextBtn.classList.toggle('btn-primary');
        addTextBtn.classList.toggle('btn-secondary');
        overlayLayer.style.pointerEvents = isAddingText ? 'auto' : 'none';
        if (isAddingText) {
            container.style.cursor = 'crosshair';
        } else {
            container.style.cursor = 'default';
        }
    });

    overlayLayer?.addEventListener('click', (e) => {
        if (!isAddingText) return;
        if (e.target !== overlayLayer) return; // clicked on existing box

        const rect = overlayLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        createTextBox(x, y);

        isAddingText = false;
        addTextBtn.classList.remove('btn-primary');
        addTextBtn.classList.add('btn-secondary');
        overlayLayer.style.pointerEvents = 'none';
        container.style.cursor = 'default';
        updateAnnotationCount();
    });

    function createTextBox(x, y, text = '', color = null, size = null) {
        const box = document.createElement('div');
        box.className = 'annotation-box';
        box.contentEditable = true;
        box.style.left = x + 'px';
        box.style.top = y + 'px';
        
        const colorInput = document.getElementById('text-color');
        const sizeInput = document.getElementById('font-size');
        const selColor = color || (colorInput ? colorInput.value : '#2563EB');
        const selSize = size || (sizeInput ? sizeInput.value : 16);
        
        box.style.color = selColor;
        box.style.fontSize = selSize + 'px';
        box.innerText = text;
        box.dataset.color = selColor;
        box.dataset.fontSize = selSize;

        // Dragging logic
        let isDragging = false;
        let offsetX, offsetY;

        box.addEventListener('mousedown', (e) => {
            if (e.target !== box) return;
            isDragging = true;
            offsetX = e.clientX - box.getBoundingClientRect().left;
            offsetY = e.clientY - box.getBoundingClientRect().top;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const rect = overlayLayer.getBoundingClientRect();
            let newX = e.clientX - rect.left - offsetX;
            let newY = e.clientY - rect.top - offsetY;
            box.style.left = newX + 'px';
            box.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        box.addEventListener('blur', () => {
            if (box.innerText.trim() === '') {
                box.remove();
            }
            updateAnnotationCount();
        });

        overlayLayer.appendChild(box);
        if (!text) {
            box.focus();
        }
    }

    function saveCurrentAnnotationsToMap() {
        const boxes = document.querySelectorAll('.annotation-box');
        const anns = [];
        boxes.forEach(box => {
            if (box.innerText.trim()) {
                anns.push({
                    x: parseFloat(box.style.left),
                    y: parseFloat(box.style.top),
                    text: box.innerText,
                    color: box.dataset.color,
                    fontSize: box.dataset.fontSize
                });
            }
        });
        annotationsMap[pageNum] = anns;
    }

    function restoreAnnotationsFromMap() {
        const anns = annotationsMap[pageNum] || [];
        anns.forEach(ann => {
            createTextBox(ann.x, ann.y, ann.text, ann.color, ann.fontSize);
        });
        updateAnnotationCount();
    }

    // Save PDF
    document.getElementById('save-pdf-btn')?.addEventListener('click', async () => {
        saveCurrentAnnotationsToMap();
        
        const payload = [];
        for (const [pageStr, anns] of Object.entries(annotationsMap)) {
            // pdf-lib pages are 0-indexed
            const pIdx = parseInt(pageStr, 10) - 1;
            anns.forEach(ann => {
                payload.push({
                    page: pIdx,
                    // Convert coordinates from scale back to original PDF points
                    x: ann.x / scale,
                    y: (ann.y + parseInt(ann.fontSize)) / scale, // adjust y to baseline roughly
                    text: ann.text,
                    color: ann.color,
                    fontSize: ann.fontSize / scale
                });
            });
        }

        if (payload.length === 0) {
            showToast('No annotations added.', 'info');
            return;
        }

        const btn = document.getElementById('save-pdf-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await apiFetch(`/api/pdf/${fileId}/annotate`, {
                method: 'PUT',
                body: { annotations: payload }
            });
            showToast('PDF Saved successfully.', 'success');
            setTimeout(() => { window.location.href = 'files.html'; }, 1000);
        } catch(e) {
            showToast(e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
        }
    });
});
