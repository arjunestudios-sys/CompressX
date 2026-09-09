/**
 * Docholder Image Studio Client Logic
 */

let currentImageFile = null;
let workspaceImages = [];
let imgOriginalWidth = 0;
let imgOriginalHeight = 0;
let activeCropRatio = 'free';
let currentRotation = 0;
let isFlippedH = false;
let isFlippedV = false;

const IMAGE_MODE_META = {
    compress: { title: 'Compress Image', icon: 'fa-compress', color: '#8B5CF6', subtitle: 'Optimize image file size while preserving rich visual quality.' },
    cyber: { title: 'Cyber FX & Hologram Filters', icon: 'fa-wand-magic-sparkles', color: '#00F0FF', subtitle: 'Futuristic aesthetic grading, synthwave neon & matrix styles.' },
    resize: { title: 'Resize Image Dimensions', icon: 'fa-up-right-and-down-left-from-center', color: '#3B82F6', subtitle: 'Scale pixel dimensions or percentage scaling with aspect ratio lock.' },
    crop: { title: 'Crop Image', icon: 'fa-crop', color: '#06B6D4', subtitle: 'Crop image to standard aspect ratios (1:1, 4:3, 16:9) or custom bounds.' },
    rotate: { title: 'Rotate & Flip Image', icon: 'fa-rotate', color: '#10B981', subtitle: 'Rotate angles (0°–360°) and flip horizontally or vertically.' },
    convert: { title: 'Convert Image Format', icon: 'fa-arrow-right-arrow-left', color: '#F59E0B', subtitle: 'Convert between WebP, JPG, PNG, PDF, TIFF, and BMP.' },
    exif: { title: 'Strip EXIF Privacy Metadata', icon: 'fa-shield-halved', color: '#10B981', subtitle: 'Wipe camera model, location GPS, and device timestamp data.' },
    'multi-pdf': { title: 'Combine Multi-Images to PDF', icon: 'fa-file-pdf', color: '#EF4444', subtitle: 'Assemble multiple image files into an organized PDF document.' }
};

document.addEventListener('DOMContentLoaded', async () => {
    setupModeChips();
    setupDropzone();
    setupControls();
    setupCropSliders();
    setupRotateControls();
    await loadWorkspaceImages();

    // Restore workspace state if available
    const savedState = getWorkspaceState('image_studio');
    const params = new URLSearchParams(window.location.search);
    const initialTool = params.get('tool') || (savedState ? savedState.mode : 'compress');
    switchMode(initialTool);

    const initialFileId = params.get('fileId') || (savedState ? savedState.fileId : null);
    if (initialFileId) {
        const sel = document.getElementById('image-file-select');
        if (sel) {
            sel.value = initialFileId;
            sel.dispatchEvent(new Event('change'));
        }
    }
});

function setupModeChips() {
    document.querySelectorAll('.category-nav-bar .action-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const mode = chip.getAttribute('data-mode');
            switchMode(mode);
        });
    });
}

function switchMode(mode) {
    const panels = ['compress', 'cyber', 'resize', 'crop', 'rotate', 'convert', 'exif', 'multi-pdf'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`panel-${mode}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const meta = IMAGE_MODE_META[mode] || { title: 'Image Studio', icon: 'fa-image', color: '#8B5CF6', subtitle: 'Intelligent image transformations.' };

    const breadcrumb = document.getElementById('img-op-breadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = `<i class="fa-solid fa-image"></i> Image → ${meta.title}`;
    }

    const titleEl = document.getElementById('img-main-op-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid ${meta.icon}" style="color: ${meta.color};"></i> ${meta.title}`;
    }

    const subEl = document.getElementById('img-main-op-subtitle');
    if (subEl) {
        subEl.textContent = meta.subtitle;
    }

    const headerTitle = document.getElementById('header-image-op-title');
    if (headerTitle) {
        headerTitle.textContent = meta.title;
    }

    const overlay = document.getElementById('crop-overlay-box');
    if (overlay) {
        if (mode === 'crop') {
            overlay.classList.remove('hidden');
            updateCropOverlay();
        } else {
            overlay.classList.add('hidden');
        }
    }

    document.querySelectorAll('.category-nav-bar .action-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === mode);
    });

    saveWorkspaceState('image_studio', {
        mode,
        fileId: currentImageFile ? currentImageFile.id : null
    });
}

let selectedMultiPdfImages = [];

async function loadWorkspaceImages() {
    try {
        const data = await apiFetch('/api/files?category=image');
        const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.bmp', '.svg', '.ico', '.heic', '.avif'];
        workspaceImages = (data.files || []).filter(f => {
            const name = (f.original_name || '').toLowerCase();
            return (f.mime_type && f.mime_type.startsWith('image/')) || imgExts.some(ext => name.endsWith(ext));
        });
        const select = document.getElementById('image-file-select');
        if (select) {
            select.innerHTML = '<option value="">-- Choose from Workspace --</option>';
            workspaceImages.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
                select.appendChild(opt);
            });

            select.addEventListener('change', async (e) => {
                const fId = e.target.value;
                if (!fId) {
                    currentImageFile = null;
                    document.getElementById('selected-image-preview-container')?.classList.add('hidden');
                    return;
                }
                currentImageFile = workspaceImages.find(f => String(f.id) === String(fId)) || null;
                if (currentImageFile) await renderSelectedImage(currentImageFile);
                
                saveWorkspaceState('image_studio', {
                    mode: document.querySelector('.action-chip.active')?.getAttribute('data-mode') || 'compress',
                    fileId: fId
                });
            });
        }

        renderMultiImagesOrderedList();
    } catch(e) {}
}

function renderMultiImagesOrderedList() {
    const listEl = document.getElementById('multi-images-ordered-list');
    const badge = document.getElementById('multi-img-count-badge');
    if (!listEl) return;

    if (selectedMultiPdfImages.length === 0 && workspaceImages.length > 0) {
        selectedMultiPdfImages = [...workspaceImages];
    }

    if (badge) badge.textContent = `${selectedMultiPdfImages.length} IMAGES`;

    if (selectedMultiPdfImages.length === 0) {
        listEl.innerHTML = `
            <div id="multi-img-empty-state" style="text-align: center; padding: 16px; border: 1px dashed var(--surface-border); border-radius: var(--radius-xs); color: var(--text-muted); font-size: 0.8rem;">
                <i class="fa-solid fa-images" style="font-size: 1.5rem; margin-bottom: 6px; display: block; color: var(--primary);"></i>
                Select images from workspace or upload below
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    selectedMultiPdfImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--surface-hover); border: 1px solid var(--surface-border); border-radius: var(--radius-xs); gap: 8px;';
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1;">
                <span class="hud-badge hud-badge-cyan" style="font-size: 0.62rem; min-width: 24px; text-align: center;">#${index + 1}</span>
                <img src="${(typeof resolveApiUrl === 'function') ? resolveApiUrl(`/api/files/${img.id}/download?inline=true`) : `/api/files/${img.id}/download?inline=true`}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--surface-border);" alt="Thumb">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${img.original_name}</div>
                    <div style="font-size: 0.72rem; color: var(--text-secondary);">${formatBytes(img.file_size)}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                <button type="button" class="btn btn-secondary btn-sm multi-btn-up" style="padding: 4px 8px; font-size: 0.75rem;" ${index === 0 ? 'disabled' : ''} title="Move Up">
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-sm multi-btn-down" style="padding: 4px 8px; font-size: 0.75rem;" ${index === selectedMultiPdfImages.length - 1 ? 'disabled' : ''} title="Move Down">
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button type="button" class="btn btn-danger btn-sm multi-btn-remove" style="padding: 4px 8px; font-size: 0.75rem;" title="Remove">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        item.querySelector('.multi-btn-up')?.addEventListener('click', () => {
            if (index > 0) {
                const temp = selectedMultiPdfImages[index];
                selectedMultiPdfImages[index] = selectedMultiPdfImages[index - 1];
                selectedMultiPdfImages[index - 1] = temp;
                renderMultiImagesOrderedList();
            }
        });

        item.querySelector('.multi-btn-down')?.addEventListener('click', () => {
            if (index < selectedMultiPdfImages.length - 1) {
                const temp = selectedMultiPdfImages[index];
                selectedMultiPdfImages[index] = selectedMultiPdfImages[index + 1];
                selectedMultiPdfImages[index + 1] = temp;
                renderMultiImagesOrderedList();
            }
        });

        item.querySelector('.multi-btn-remove')?.addEventListener('click', () => {
            selectedMultiPdfImages.splice(index, 1);
            renderMultiImagesOrderedList();
        });

        listEl.appendChild(item);
    });
}

async function renderSelectedImage(file) {
    const prevContainer = document.getElementById('selected-image-preview-container');
    const prevImg = document.getElementById('selected-image-preview');
    const prevInfo = document.getElementById('selected-image-info');
    if (prevContainer && prevImg) {
        prevContainer.classList.remove('hidden');
        prevImg.src = (typeof resolveApiUrl === 'function') ? resolveApiUrl(`/api/files/${file.id}/download?inline=true`) : `/api/files/${file.id}/download?inline=true`;
        
        try {
            const insp = await apiFetch(`/api/files/${file.id}/inspect`);
            if (insp && insp.details && insp.details.width) {
                imgOriginalWidth = insp.details.width;
                imgOriginalHeight = insp.details.height;
                if (prevInfo) prevInfo.textContent = `${file.original_name} • ${imgOriginalWidth} × ${imgOriginalHeight} px • ${formatBytes(file.file_size)}`;
                
                const wInput = document.getElementById('img-resize-width');
                const hInput = document.getElementById('img-resize-height');
                if (wInput) wInput.value = imgOriginalWidth;
                if (hInput) hInput.value = imgOriginalHeight;
                updateDimensionsBadge();
            } else if (prevInfo) {
                prevInfo.textContent = `${file.original_name} • ${formatBytes(file.file_size)}`;
            }
        } catch(e) {
            if (prevInfo) prevInfo.textContent = `${file.original_name} • ${formatBytes(file.file_size)}`;
        }
    }
}

function updateDimensionsBadge() {
    const origBadge = document.getElementById('img-orig-dim-text');
    const outBadge = document.getElementById('img-out-dim-text');
    const w = document.getElementById('img-resize-width')?.value || imgOriginalWidth || 0;
    const h = document.getElementById('img-resize-height')?.value || imgOriginalHeight || 0;
    if (origBadge) origBadge.textContent = `${imgOriginalWidth || '?'} × ${imgOriginalHeight || '?'} px`;
    if (outBadge) outBadge.textContent = `${w} × ${h} px`;
}

function setupDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    const input = document.getElementById('image-file-input');
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
            await handleImageUpload(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await handleImageUpload(e.target.files[0]);
        }
    });
}

async function handleImageUpload(fileObj) {
    const dropzone = document.getElementById('image-dropzone');
    const tracker = typeof renderFileUploadTracker === 'function' ? renderFileUploadTracker(dropzone, fileObj) : null;

    try {
        if (tracker) tracker.update(25, 'Loading image... 25%', 'Est: ~1s');
        await new Promise(r => setTimeout(r, 80));

        if (tracker) tracker.update(60, 'Reading image pixels... 60%', 'Est: ~1s');

        const res = await uploadFileWithProgress('/api/files/upload', fileObj, (p) => {
            if (tracker && p.percent) {
                const scaled = Math.min(88, Math.max(25, Math.round(p.percent * 0.88)));
                tracker.update(scaled, `Reading image pixels... ${scaled}%`);
            }
        });

        if (tracker) tracker.update(95, 'Preparing image canvas... 95%');
        await new Promise(r => setTimeout(r, 60));

        if (tracker) tracker.ready(fileObj.name);
        showToast('Image uploaded successfully!', 'success');
        await loadWorkspaceImages();
        
        const sel = document.getElementById('image-file-select');
        if (sel && res.file) {
            sel.value = res.file.id;
            currentImageFile = res.file;
            await renderSelectedImage(currentImageFile);
        }
    } catch(e) {
        if (tracker) tracker.error(e.message || 'Upload failed');
        showToast(e.message || 'Upload failed.', 'error');
    }
}

function setupCropSliders() {
    document.querySelectorAll('.img-crop-ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.img-crop-ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCropRatio = btn.getAttribute('data-ratio');

            const wSlider = document.getElementById('crop-w-slider');
            const hSlider = document.getElementById('crop-h-slider');

            if (activeCropRatio === '1:1') {
                if (wSlider && hSlider) {
                    hSlider.value = wSlider.value;
                }
            } else if (activeCropRatio === '16:9') {
                if (wSlider && hSlider) {
                    hSlider.value = Math.max(20, Math.round(wSlider.value * (9 / 16)));
                }
            } else if (activeCropRatio === '4:3') {
                if (wSlider && hSlider) {
                    hSlider.value = Math.max(20, Math.round(wSlider.value * (3 / 4)));
                }
            }

            updateCropOverlay();
        });
    });

    const wSlider = document.getElementById('crop-w-slider');
    const hSlider = document.getElementById('crop-h-slider');
    const wVal = document.getElementById('crop-w-val');
    const hVal = document.getElementById('crop-h-val');

    if (wSlider && wVal) {
        wSlider.addEventListener('input', (e) => {
            wVal.textContent = `${e.target.value}%`;
            if (activeCropRatio === '1:1' && hSlider) {
                hSlider.value = e.target.value;
                if (hVal) hVal.textContent = `${e.target.value}%`;
            }
            updateCropOverlay();
        });
    }

    if (hSlider && hVal) {
        hSlider.addEventListener('input', (e) => {
            hVal.textContent = `${e.target.value}%`;
            if (activeCropRatio === '1:1' && wSlider) {
                wSlider.value = e.target.value;
                if (wVal) wVal.textContent = `${e.target.value}%`;
            }
            updateCropOverlay();
        });
    }

    const resetBtn = document.getElementById('btn-reset-crop');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (wSlider) { wSlider.value = 80; if (wVal) wVal.textContent = '80%'; }
            if (hSlider) { hSlider.value = 80; if (hVal) hVal.textContent = '80%'; }
            updateCropOverlay();
        });
    }
}

function updateCropOverlay() {
    const overlay = document.getElementById('crop-overlay-box');
    const img = document.getElementById('selected-image-preview');
    if (!overlay || !img) return;

    const wPercent = parseInt(document.getElementById('crop-w-slider')?.value || '80', 10);
    const hPercent = parseInt(document.getElementById('crop-h-slider')?.value || '80', 10);

    overlay.style.width = `${wPercent}%`;
    overlay.style.height = `${hPercent}%`;
    overlay.style.left = `${(100 - wPercent) / 2}%`;
    overlay.style.top = `${(100 - hPercent) / 2}%`;
}

function setupRotateControls() {
    const img = document.getElementById('selected-image-preview');
    const rotSlider = document.getElementById('custom-rot-slider');
    const rotVal = document.getElementById('custom-rot-val');

    function applyLiveTransform() {
        if (!img) return;
        const scaleX = isFlippedH ? -1 : 1;
        const scaleY = isFlippedV ? -1 : 1;
        img.style.transform = `rotate(${currentRotation}deg) scale(${scaleX}, ${scaleY})`;
    }

    document.getElementById('btn-rotate-left')?.addEventListener('click', () => {
        currentRotation = (currentRotation - 90 + 360) % 360;
        if (rotSlider) rotSlider.value = currentRotation;
        if (rotVal) rotVal.textContent = `${currentRotation}°`;
        applyLiveTransform();
    });

    document.getElementById('btn-rotate-90')?.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        if (rotSlider) rotSlider.value = currentRotation;
        if (rotVal) rotVal.textContent = `${currentRotation}°`;
        applyLiveTransform();
    });

    document.getElementById('btn-rotate-180')?.addEventListener('click', () => {
        currentRotation = (currentRotation + 180) % 360;
        if (rotSlider) rotSlider.value = currentRotation;
        if (rotVal) rotVal.textContent = `${currentRotation}°`;
        applyLiveTransform();
    });

    document.getElementById('btn-flip-h')?.addEventListener('click', () => {
        isFlippedH = !isFlippedH;
        applyLiveTransform();
    });

    document.getElementById('btn-flip-v')?.addEventListener('click', () => {
        isFlippedV = !isFlippedV;
        applyLiveTransform();
    });

    if (rotSlider && rotVal) {
        rotSlider.addEventListener('input', (e) => {
            currentRotation = parseInt(e.target.value, 10);
            rotVal.textContent = `${currentRotation}°`;
            applyLiveTransform();
        });
    }
}

function setupControls() {
    // Quality slider
    const qSlider = document.getElementById('img-quality-slider');
    const qVal = document.getElementById('img-quality-val');
    if (qSlider && qVal) {
        qSlider.addEventListener('input', (e) => qVal.textContent = `${e.target.value}%`);
    }

    // Resize preset dropdown
    const resizePreset = document.getElementById('img-resize-preset');
    const wInput = document.getElementById('img-resize-width');
    const hInput = document.getElementById('img-resize-height');
    if (resizePreset) {
        resizePreset.addEventListener('change', () => {
            const p = resizePreset.value;
            if (p === 'original') {
                if (wInput) wInput.value = imgOriginalWidth || 1920;
                if (hInput) hInput.value = imgOriginalHeight || 1080;
            } else if (p === '1080p') {
                if (wInput) wInput.value = 1920;
                if (hInput) hInput.value = 1080;
            } else if (p === '720p') {
                if (wInput) wInput.value = 1280;
                if (hInput) hInput.value = 720;
            } else if (p === 'square') {
                if (wInput) wInput.value = 1080;
                if (hInput) hInput.value = 1080;
            } else if (p === '50%') {
                if (wInput) wInput.value = Math.round((imgOriginalWidth || 1000) * 0.5);
                if (hInput) hInput.value = Math.round((imgOriginalHeight || 1000) * 0.5);
            } else if (p === '25%') {
                if (wInput) wInput.value = Math.round((imgOriginalWidth || 1000) * 0.25);
                if (hInput) hInput.value = Math.round((imgOriginalHeight || 1000) * 0.25);
            } else if (p === '4k') {
                if (wInput) wInput.value = 3840;
                if (hInput) hInput.value = 2160;
            }
            updateDimensionsBadge();
        });
    }

    if (wInput) wInput.addEventListener('input', updateDimensionsBadge);
    if (hInput) hInput.addEventListener('input', updateDimensionsBadge);

    // Cyberpunk FX & Matrix Filter Runner
    const btnCyber = document.getElementById('btn-apply-cyber-fx');
    const cyberIntensity = document.getElementById('cyber-intensity-range');
    const cyberIntensityVal = document.getElementById('cyber-intensity-val');
    if (cyberIntensity && cyberIntensityVal) {
        cyberIntensity.addEventListener('input', (e) => cyberIntensityVal.textContent = `${e.target.value}%`);
    }

    if (btnCyber) {
        btnCyber.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');
            const filterType = document.getElementById('cyber-filter-select')?.value || 'neon-synth';
            const intensity = parseInt(document.getElementById('cyber-intensity-range')?.value || '80', 10) / 100;
            
            showOperationLoader({
                title: 'Rendering Cyber Hologram FX',
                subtitle: `Applying ${filterType} matrix transformation...`,
                stages: ['Rasterizing image buffer...', 'Calculating photon matrix...', 'Synthesizing cyberpunk output...']
            });

            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = (typeof resolveApiUrl === 'function') ? resolveApiUrl(`/api/files/${currentImageFile.id}/download?inline=true`) : `/api/files/${currentImageFile.id}/download?inline=true`;
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = rej;
                });

                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 800;
                canvas.height = img.naturalHeight || 600;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0);

                if (filterType === 'neon-synth') {
                    ctx.globalCompositeOperation = 'overlay';
                    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                    grad.addColorStop(0, `rgba(0, 240, 255, ${0.45 * intensity})`);
                    grad.addColorStop(1, `rgba(255, 0, 122, ${0.45 * intensity})`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'source-over';
                } else if (filterType === 'matrix-terminal') {
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
                        d[i] = 0;
                        d[i+1] = Math.min(255, lum * 1.3 * intensity + d[i+1] * (1 - intensity));
                        d[i+2] = Math.min(255, lum * 0.2);
                    }
                    ctx.putImageData(imgData, 0, 0);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                    for (let y = 0; y < canvas.height; y += 4) {
                        ctx.fillRect(0, y, canvas.width, 2);
                    }
                } else if (filterType === 'holo-blue') {
                    ctx.globalCompositeOperation = 'color';
                    ctx.fillStyle = `rgba(0, 200, 255, ${0.7 * intensity})`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'source-over';
                } else if (filterType === 'glitch-rgb') {
                    const offset = Math.round(10 * intensity);
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const copy = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    const c = copy.data;
                    const w = canvas.width;
                    for (let y = 0; y < canvas.height; y++) {
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4;
                            const rIdx = (y * w + Math.min(w - 1, x + offset)) * 4;
                            const bIdx = (y * w + Math.max(0, x - offset)) * 4;
                            d[i] = c[rIdx];
                            d[i+2] = c[bIdx+2];
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                } else if (filterType === 'thermal-vision') {
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const lum = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) / 255;
                        if (lum < 0.33) {
                            d[i] = Math.round(lum * 3 * 180);
                            d[i+1] = 0;
                            d[i+2] = Math.round(255 * (1 - lum * 3));
                        } else if (lum < 0.66) {
                            d[i] = 255;
                            d[i+1] = Math.round((lum - 0.33) * 3 * 220);
                            d[i+2] = 0;
                        } else {
                            d[i] = 255;
                            d[i+1] = 255;
                            d[i+2] = Math.round((lum - 0.66) * 3 * 255);
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                } else if (filterType === 'quantum-invert') {
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        d[i] = 255 - d[i];
                        d[i+1] = Math.min(255, (255 - d[i+1]) * 1.1);
                        d[i+2] = 255 - d[i+2];
                    }
                    ctx.putImageData(imgData, 0, 0);
                }

                canvas.toBlob(async (blob) => {
                    const newName = `cyber_${filterType}_${currentImageFile.original_name.replace(/\.[^/.]+$/, '')}.png`;
                    const uploadFile = new File([blob], newName, { type: 'image/png' });
                    const formData = new FormData();
                    formData.append('file', uploadFile);

                    const uploadRes = await apiFetch('/api/files/upload', {
                        method: 'POST',
                        body: formData
                    });

                    hideOperationLoader();
                    window.DocholderAudio.playSuccess();
                    showToast('Cyber transformation rendered successfully!', 'success');

                    if (typeof renderImageResult === 'function') {
                        renderImageResult({
                            originalName: newName,
                            originalSize: currentImageFile.file_size,
                            convertedSize: blob.size,
                            percentageSaved: 0,
                            downloadUrl: `/api/files/${uploadRes.file.id}/download`
                        });
                    }

                    await loadWorkspaceImages();
                }, 'image/png', 0.92);

            } catch (err) {
                hideOperationLoader();
                window.DocholderAudio.playAlert();
                showToast(err.message || 'Cyber FX rendering failed.', 'error');
            }
        });
    }

    // 1. Compress Image
    const btnCompress = document.getElementById('btn-compress-image');
    if (btnCompress) {
        btnCompress.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');
            const quality = parseInt(document.getElementById('img-quality-slider')?.value || '85', 10);
            
            let targetSizeBytes = null;
            const targetVal = parseFloat(document.getElementById('img-target-size-val')?.value || '0');
            const targetUnit = document.getElementById('img-target-size-unit')?.value || 'KB';
            if (targetVal > 0) {
                targetSizeBytes = targetUnit === 'MB' ? targetVal * 1024 * 1024 : targetVal * 1024;
            }

            showOperationLoader({
                title: 'Compressing Image',
                subtitle: 'Optimizing image quality and bitrate...',
                stages: ['Decoding image buffer...', 'Optimizing quantization tables...', 'Writing compressed output...']
            });

            try {
                const res = await apiFetch('/api/image/compress', {
                    method: 'POST',
                    body: { fileId: currentImageFile.id, quality, targetSizeBytes }
                });
                hideOperationLoader();
                showToast('Image compressed successfully!', 'success');
                displayImageResult(res.result, 'Image Compressed Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Compression failed.', 'error');
            }
        });
    }

    // Preset Dimensions Selection Listener
    const presetSelect = document.getElementById('img-resize-preset');
    const widthInput = document.getElementById('img-resize-width');
    const heightInput = document.getElementById('img-resize-height');
    const maintainAspect = document.getElementById('img-maintain-aspect');

    if (presetSelect && widthInput && heightInput) {
        presetSelect.addEventListener('change', () => {
            const val = presetSelect.value;
            if (!val || val === 'original') {
                if (imgOriginalWidth) widthInput.value = imgOriginalWidth;
                if (imgOriginalHeight) heightInput.value = imgOriginalHeight;
            } else if (val === 'twitter') {
                widthInput.value = 1200;
                heightInput.value = 675;
            } else if (val === 'twitter_avatar') {
                widthInput.value = 400;
                heightInput.value = 400;
            } else if (val === 'threads' || val === 'instagram' || val === 'square') {
                widthInput.value = 1080;
                heightInput.value = 1080;
            } else if (val === 'threads_portrait') {
                widthInput.value = 1080;
                heightInput.value = 1350;
            } else if (val === 'reels' || val === 'tiktok' || val === 'shorts') {
                widthInput.value = 1080;
                heightInput.value = 1920;
            } else if (val === 'discord_avatar') {
                widthInput.value = 256;
                heightInput.value = 256;
            } else if (val === 'discord_emote') {
                widthInput.value = 128;
                heightInput.value = 128;
            } else if (val === 'youtube_thumb') {
                widthInput.value = 1280;
                heightInput.value = 720;
            } else if (val === 'linkedin') {
                widthInput.value = 1200;
                heightInput.value = 627;
            } else if (val === '1080p') {
                widthInput.value = 1920;
                heightInput.value = 1080;
            } else if (val === '720p') {
                widthInput.value = 1280;
                heightInput.value = 720;
            } else if (val === '4k') {
                widthInput.value = 3840;
                heightInput.value = 2160;
            } else if (val === '50%' && imgOriginalWidth && imgOriginalHeight) {
                widthInput.value = Math.round(imgOriginalWidth * 0.5);
                heightInput.value = Math.round(imgOriginalHeight * 0.5);
            } else if (val === '25%' && imgOriginalWidth && imgOriginalHeight) {
                widthInput.value = Math.round(imgOriginalWidth * 0.25);
                heightInput.value = Math.round(imgOriginalHeight * 0.25);
            }
            updateDimensionsBadge();
        });

        widthInput.addEventListener('input', () => {
            if (maintainAspect && maintainAspect.checked && imgOriginalWidth && imgOriginalHeight) {
                const w = parseInt(widthInput.value || '0', 10);
                if (w > 0) heightInput.value = Math.round(w * (imgOriginalHeight / imgOriginalWidth));
            }
            updateDimensionsBadge();
        });

        heightInput.addEventListener('input', () => {
            if (maintainAspect && maintainAspect.checked && imgOriginalWidth && imgOriginalHeight) {
                const h = parseInt(heightInput.value || '0', 10);
                if (h > 0) widthInput.value = Math.round(h * (imgOriginalWidth / imgOriginalHeight));
            }
            updateDimensionsBadge();
        });
    }

    // 2. Resize Image (Section 9)
    const btnResize = document.getElementById('btn-resize-image');
    if (btnResize) {
        btnResize.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');
            const width = parseInt(document.getElementById('img-resize-width')?.value || '0', 10);
            const height = parseInt(document.getElementById('img-resize-height')?.value || '0', 10);
            const preset = document.getElementById('img-resize-preset')?.value || null;

            if (!width && !height && !preset) {
                return showToast('Please specify target width or height.', 'warning');
            }

            showOperationLoader({
                title: 'Resizing Image',
                subtitle: 'Rescaling image dimensions...',
                stages: ['Computing bicubic interpolation...', 'Resizing pixels...', 'Finalizing image file...']
            });

            try {
                const res = await apiFetch('/api/image/resize', {
                    method: 'POST',
                    body: { fileId: currentImageFile.id, width, height, preset }
                });
                hideOperationLoader();
                showToast('Image resized successfully!', 'success');
                displayImageResult(res.result, 'Image Resized Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Resize failed.', 'error');
            }
        });
    }

    // 3. Crop Image (Section 11)
    const btnApplyCrop = document.getElementById('btn-apply-crop');
    if (btnApplyCrop) {
        btnApplyCrop.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');

            const wPercent = parseInt(document.getElementById('crop-w-slider')?.value || '80', 10) / 100;
            const hPercent = parseInt(document.getElementById('crop-h-slider')?.value || '80', 10) / 100;

            const baseW = imgOriginalWidth || 1000;
            const baseH = imgOriginalHeight || 1000;

            const cropW = Math.max(10, Math.round(baseW * wPercent));
            const cropH = Math.max(10, Math.round(baseH * hPercent));
            const left = Math.max(0, Math.round((baseW - cropW) / 2));
            const top = Math.max(0, Math.round((baseH - cropH) / 2));

            showOperationLoader({
                title: 'Cropping Image',
                subtitle: 'Extracting specified boundary region...',
                stages: ['Calculating pixel coordinates...', 'Extracting crop box...', 'Writing output image...']
            });

            try {
                const res = await apiFetch('/api/image/crop', {
                    method: 'POST',
                    body: { fileId: currentImageFile.id, left, top, width: cropW, height: cropH }
                });
                hideOperationLoader();
                showToast('Image cropped successfully!', 'success');
                displayImageResult(res.result, 'Image Cropped Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Cropping failed.', 'error');
            }
        });
    }

    // 4. Rotate & Flip (Section 12)
    const btnApplyTransform = document.getElementById('btn-apply-custom-rotate');
    if (btnApplyTransform) {
        btnApplyTransform.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');

            showOperationLoader({
                title: 'Transforming Image',
                subtitle: 'Applying rotation & flip operations...',
                stages: ['Rotating orientation matrix...', 'Applying geometric reflections...', 'Saving transformed image...']
            });

            try {
                const res = await apiFetch('/api/image/transform', {
                    method: 'POST',
                    body: {
                        fileId: currentImageFile.id,
                        rotate: currentRotation,
                        flip: isFlippedV,
                        flop: isFlippedH
                    }
                });
                hideOperationLoader();
                showToast('Image transformed successfully!', 'success');
                displayImageResult(res.result, 'Image Transformed Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Transformation failed.', 'error');
            }
        });
    }

    // 5. Convert Format (Section 10)
    const targetFormatSelect = document.getElementById('img-target-format');
    const pdfOptionsBox = document.getElementById('img-to-pdf-options');
    if (targetFormatSelect && pdfOptionsBox) {
        targetFormatSelect.addEventListener('change', () => {
            if (targetFormatSelect.value === 'pdf') {
                pdfOptionsBox.classList.remove('hidden');
            } else {
                pdfOptionsBox.classList.add('hidden');
            }
        });
    }

    const btnConvert = document.getElementById('btn-convert-image');
    if (btnConvert) {
        btnConvert.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');
            const format = document.getElementById('img-target-format')?.value || 'webp';
            const pageSize = document.getElementById('img-pdf-page-size')?.value || 'auto';
            const orientation = document.getElementById('img-pdf-orientation')?.value || 'portrait';
            const fit = document.getElementById('img-pdf-fit')?.value || 'contain';

            const progressWrapper = document.getElementById('img-convert-progress-wrapper');
            const progressFill = document.getElementById('img-convert-progress-fill');
            const progressStatus = document.getElementById('img-convert-progress-status');
            const progressPercent = document.getElementById('img-convert-progress-percent');

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '25%';
            if (progressPercent) progressPercent.textContent = '25%';
            if (progressStatus) progressStatus.textContent = `Preparing image for ${format.toUpperCase()}...`;

            btnConvert.disabled = true;

            try {
                if (progressFill) progressFill.style.width = '65%';
                if (progressPercent) progressPercent.textContent = '65%';
                if (progressStatus) progressStatus.textContent = `Encoding ${format.toUpperCase()} buffers...`;

                const res = await apiFetch('/api/image/convert', {
                    method: 'POST',
                    body: {
                        fileId: currentImageFile.id,
                        format,
                        pageSize,
                        orientation,
                        fit
                    }
                });

                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'Conversion complete ✓';

                showToast(`Image converted to ${format.toUpperCase()} successfully!`, 'success');
                displayImageResult(res.result, `Converted to ${format.toUpperCase()}`);
            } catch(e) {
                showToast(e.message || 'Conversion failed.', 'error', 5000, {
                    text: 'Choose Format',
                    onClick: () => document.getElementById('img-target-format')?.focus()
                });
            } finally {
                btnConvert.disabled = false;
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2000);
            }
        });
    }

    // 6. Strip EXIF
    const btnStripExif = document.getElementById('btn-strip-exif');
    if (btnStripExif) {
        btnStripExif.addEventListener('click', async () => {
            if (!currentImageFile) return showToast('Please select an image first.', 'warning');

            showOperationLoader({
                title: 'Stripping EXIF Metadata',
                subtitle: 'Removing GPS, camera IDs, and timestamps...',
                stages: ['Locating EXIF headers...', 'Scrubbing metadata payload...', 'Saving privacy-sanitized image...']
            });

            try {
                const res = await apiFetch('/api/image/strip-exif', {
                    method: 'POST',
                    body: { fileId: currentImageFile.id }
                });
                hideOperationLoader();
                showToast('EXIF metadata removed successfully!', 'success');
                displayImageResult(res.result, 'Metadata Scrubbed Successfully');
            } catch(e) {
                hideOperationLoader();
                showToast(e.message || 'Stripping EXIF failed.', 'error');
            }
        });
    }

    // 7. Multi-Images to PDF with Reordering & Progress
    const btnMultiPdf = document.getElementById('btn-multi-pdf');
    if (btnMultiPdf) {
        btnMultiPdf.addEventListener('click', async () => {
            if (selectedMultiPdfImages.length === 0) {
                return showToast('Please select at least one image to combine.', 'warning');
            }

            const customName = document.getElementById('multi-pdf-custom-name')?.value || '';
            const pageSize = document.getElementById('multi-pdf-page-size')?.value || 'auto';
            const orientation = document.getElementById('multi-pdf-orientation')?.value || 'portrait';

            const progressWrapper = document.getElementById('multi-pdf-progress-wrapper');
            const progressFill = document.getElementById('multi-pdf-progress-fill');
            const progressStatus = document.getElementById('multi-pdf-progress-status');
            const progressPercent = document.getElementById('multi-pdf-progress-percent');

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '20%';
            if (progressPercent) progressPercent.textContent = '20%';
            if (progressStatus) progressStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading images in specified sequence...';

            btnMultiPdf.disabled = true;

            let pTimer = setInterval(() => {
                if (progressPercent && progressFill && progressStatus) {
                    let cur = parseInt(progressPercent.textContent || '20', 10);
                    if (cur < 85) {
                        cur += 20;
                        progressPercent.textContent = `${cur}%`;
                        progressFill.style.width = `${cur}%`;
                        if (cur >= 40 && cur < 70) progressStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Embedding image pages into PDF tree...';
                        if (cur >= 70) progressStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compiling combined PDF...';
                    }
                }
            }, 250);

            try {
                const orderedIds = selectedMultiPdfImages.map(img => img.id);
                const res = await apiFetch('/api/image/multi-pdf', {
                    method: 'POST',
                    body: {
                        fileIds: orderedIds,
                        customName,
                        pageSize,
                        orientation
                    }
                });

                clearInterval(pTimer);
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressFill) progressFill.style.width = '100%';
                if (progressStatus) progressStatus.textContent = 'PDF generated successfully ✓';

                showToast(`Combined ${selectedMultiPdfImages.length} images into PDF!`, 'success');
                displayImageResult(res.result, 'Combined Images into PDF');
            } catch(e) {
                clearInterval(pTimer);
                showToast(e.message || 'PDF creation failed.', 'error');
            } finally {
                btnMultiPdf.disabled = false;
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2000);
            }
        });
    }
}

function displayImageResult(result, title = 'Image Processed!') {
    const card = document.getElementById('image-result-card');
    if (!card) return;
    card.classList.remove('hidden');

    const titleEl = document.getElementById('image-result-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${title}`;

    const beforeVal = document.getElementById('img-before-val');
    const afterVal = document.getElementById('img-after-val');
    const savedBadge = document.getElementById('img-result-saved');
    const prevImg = document.getElementById('img-result-preview');
    const prevLink = document.getElementById('img-preview-link');
    const dlLink = document.getElementById('img-download-link');

    if (beforeVal) beforeVal.textContent = formatBytes(result.originalSize || 0);
    if (afterVal) afterVal.textContent = formatBytes(result.convertedSize || 0);
    if (savedBadge) {
        const saved = result.percentageSaved || 0;
        savedBadge.textContent = `${saved}% Saved`;
        savedBadge.style.display = saved > 0 ? 'inline-block' : 'none';
    }

    if (prevImg) {
        prevImg.src = `${result.downloadUrl}?inline=true`;
    }
    if (prevLink) {
        prevLink.href = `${result.downloadUrl}?inline=true`;
    }
    if (dlLink) {
        dlLink.href = result.downloadUrl;
        dlLink.download = result.originalName;
    }

    const settings = getDocholderSettings();
    if (settings.autoDownload && dlLink && dlLink.href) {
        const autoLink = document.createElement('a');
        autoLink.href = dlLink.href;
        autoLink.download = result.originalName;
        document.body.appendChild(autoLink);
        autoLink.click();
        autoLink.remove();
    }

    card.scrollIntoView({ behavior: 'smooth' });
}
