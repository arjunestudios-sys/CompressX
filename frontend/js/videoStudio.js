/**
 * Docholder Video Studio Client Logic
 */

let currentVideoFile = null;
let workspaceVideos = [];

const VIDEO_MODE_TITLES = {
    compress: 'Compress Video',
    extract: 'Extract Audio to MP3 / WAV',
    convert: 'Convert Video Format',
    resize: 'Scale Video Resolution',
    trim: 'Trim Video Duration',
    gif: 'Convert Video to Animated GIF',
    merge: 'Merge Multiple Videos'
};

document.addEventListener('DOMContentLoaded', async () => {
    setupModeChips();
    setupDropzone();
    setupControls();
    await loadWorkspaceVideos();

    // Restore workspace state if available
    const savedState = getWorkspaceState('video_studio');
    const params = new URLSearchParams(window.location.search);
    const initialTool = params.get('tool') || (savedState ? savedState.mode : 'compress');
    switchMode(initialTool);

    const initialFileId = params.get('fileId') || (savedState ? savedState.fileId : null);
    if (initialFileId) {
        const sel = document.getElementById('video-file-select');
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
    const panels = ['compress', 'extract', 'convert', 'resize', 'trim', 'gif', 'merge'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`panel-${mode}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const titleEl = document.querySelector('.page-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-video" style="color: #EC4899;"></i> ${VIDEO_MODE_TITLES[mode] || 'Video Studio'}`;
    }
    const headerTitle = document.querySelector('.mobile-header-title span');
    if (headerTitle) {
        headerTitle.textContent = VIDEO_MODE_TITLES[mode] || 'Video Studio';
    }

    document.querySelectorAll('.category-nav-bar .action-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === mode);
    });

    saveWorkspaceState('video_studio', {
        mode,
        fileId: currentVideoFile ? currentVideoFile.id : null
    });
}

async function loadWorkspaceVideos() {
    try {
        const data = await apiFetch('/api/files?category=video');
        const vidExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.flv', '.wmv'];
        workspaceVideos = (data.files || []).filter(f => {
            const name = (f.original_name || '').toLowerCase();
            return (f.mime_type && f.mime_type.startsWith('video/')) || vidExts.some(ext => name.endsWith(ext));
        });
        const select = document.getElementById('video-file-select');
        if (select) {
            select.innerHTML = '<option value="">-- Choose from Workspace --</option>';
            workspaceVideos.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                const fId = e.target.value;
                if (!fId) {
                    currentVideoFile = null;
                    document.getElementById('selected-video-preview-container').classList.add('hidden');
                    return;
                }
                currentVideoFile = workspaceVideos.find(f => String(f.id) === String(fId)) || null;
                if (currentVideoFile) renderSelectedVideo(currentVideoFile);
                
                saveWorkspaceState('video_studio', {
                    mode: document.querySelector('.action-chip.active')?.getAttribute('data-mode') || 'compress',
                    fileId: fId
                });
            });
        }
        renderVideoMultiList();
    } catch(e) {}
}

function renderVideoMultiList() {
    const list = document.getElementById('video-multi-select-list');
    if (!list) return;
    if (workspaceVideos.length === 0) {
        list.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary);">No videos found in workspace.</div>';
        return;
    }
    list.innerHTML = workspaceVideos.map(f => `
        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; background:var(--surface); padding:6px 10px; border-radius:var(--radius-xs); border:1px solid var(--surface-border); cursor:pointer;">
            <input type="checkbox" class="video-merge-checkbox" value="${f.id}" checked>
            <i class="fa-solid fa-file-video" style="color:#EC4899;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.original_name}</span>
            <span style="color:var(--text-secondary); font-size:0.72rem;">${formatBytes(f.file_size)}</span>
        </label>
    `).join('');
}

async function renderSelectedVideo(file) {
    const prevContainer = document.getElementById('selected-video-preview-container');
    const player = document.getElementById('selected-video-player');
    const metaBadge = document.getElementById('selected-video-meta-badge');
    if (prevContainer && player) {
        prevContainer.classList.remove('hidden');
        player.src = `/api/files/${file.id}/download?inline=true`;
        if (metaBadge) metaBadge.textContent = `${file.original_name} • ${formatBytes(file.file_size)}`;

        player.ontimeupdate = () => {
            const timecodeEl = document.getElementById('video-hud-timecode');
            if (timecodeEl) {
                const totalSec = Math.floor(player.currentTime || 0);
                const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
                const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
                const secs = String(totalSec % 60).padStart(2, '0');
                timecodeEl.textContent = `${hrs}:${mins}:${secs}`;
            }
        };

        // Fetch detailed metadata from backend
        try {
            const metaRes = await apiFetch(`/api/media/metadata/${file.id}`);
            if (metaRes && metaRes.metadata) {
                const m = metaRes.metadata;
                let parts = [];
                if (m.durationFormatted) parts.push(`Duration: ${m.durationFormatted}`);
                if (m.resolution) parts.push(`Resolution: ${m.resolution}`);
                if (m.fps) parts.push(`${m.fps} FPS`);
                if (parts.length > 0 && metaBadge) {
                    metaBadge.textContent = `${file.original_name} (${parts.join(' • ')})`;
                }
            }
            // Heavy File Inspector (Requirement 10)
            const dropzone = document.getElementById('video-dropzone');
            if (dropzone && typeof renderHeavyFileInspector === 'function') {
                renderHeavyFileInspector(dropzone, file, { mediaType: 'video', duration: metaRes?.metadata?.duration });
            }
        } catch(e) {}
    }
}

function setupDropzone() {
    const dropzone = document.getElementById('video-dropzone');
    const input = document.getElementById('video-file-input');
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
            await handleVideoUpload(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await handleVideoUpload(e.target.files[0]);
        }
    });
}

async function handleVideoUpload(fileObj) {
    const dropzone = document.getElementById('video-dropzone');
    const tracker = typeof renderFileUploadTracker === 'function' ? renderFileUploadTracker(dropzone, fileObj) : null;

    try {
        if (tracker) tracker.update(20, 'Loading video file... 20%', 'Est: ~2s');
        await new Promise(r => setTimeout(r, 100));

        if (tracker) tracker.update(50, 'Reading video stream... 50%', 'Est: ~1s');

        const res = await uploadFileWithProgress('/api/files/upload', fileObj, (p) => {
            if (tracker && p.percent) {
                const scaled = Math.min(88, Math.max(20, Math.round(p.percent * 0.88)));
                tracker.update(scaled, `Reading video stream... ${scaled}%`);
            }
        });

        if (tracker) tracker.update(95, 'Probing codecs & bitrate... 95%');
        await new Promise(r => setTimeout(r, 80));

        if (tracker) tracker.ready(fileObj.name);
        showToast('Video uploaded successfully!', 'success');
        await loadWorkspaceVideos();
        
        const select = document.getElementById('video-file-select');
        if (select && res.file) {
            select.value = res.file.id;
            select.dispatchEvent(new Event('change'));
        }
    } catch(err) {
        if (tracker) tracker.error(err.message || 'Upload failed');
        showToast(err.message || 'Upload failed.', 'error');
    }
}

function setupControls() {
    // 1. Compress Video
    const btnCompress = document.getElementById('btn-compress-video');
    if (btnCompress) {
        btnCompress.addEventListener('click', async () => {
            if (!currentVideoFile) return showToast('Please select a video first.', 'warning');

            const quality = document.getElementById('vid-quality-preset')?.value || 'medium';
            const resolution = document.getElementById('vid-res-select')?.value || '';
            const targetMb = parseFloat(document.getElementById('vid-target-size-val')?.value);
            const removeAudio = document.getElementById('vid-strip-audio')?.checked === true;
            const targetSizeBytes = targetMb && targetMb > 0 ? Math.round(targetMb * 1024 * 1024) : null;

            showOperationLoader({
                title: 'Compressing Video Track',
                subtitle: targetSizeBytes ? `Optimizing below ${targetMb} MB...` : `Encoding with preset ${quality}...`,
                stages: ['Analyzing video bitstream...', 'Running multi-pass H.264/AAC compression...', 'Finalizing output container...']
            });

            try {
                const res = await apiFetch('/api/media/compress-video', {
                    method: 'POST',
                    body: { fileId: currentVideoFile.id, quality, resolution, targetSizeBytes, removeAudio }
                });
                hideOperationLoader();
                showToast('Video compressed successfully!', 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Compression failed.', 'error');
            }
        });
    }

    // 2. Extract Audio
    const btnExtract = document.getElementById('btn-extract-audio');
    if (btnExtract) {
        btnExtract.addEventListener('click', async () => {
            if (!currentVideoFile) return showToast('Please select a video first.', 'warning');
            
            const format = document.getElementById('vid-audio-format')?.value || 'mp3';
            const bitrate = document.getElementById('vid-audio-bitrate')?.value || '192k';

            showOperationLoader({
                title: 'Extracting Audio Track',
                subtitle: `Demuxing and converting to ${format.toUpperCase()} (${bitrate})...`,
                stages: ['Demuxing audio stream from video...', `Transcoding to ${format.toUpperCase()}...`, 'Generating audio asset...']
            });

            try {
                const res = await apiFetch('/api/media/extract-audio', {
                    method: 'POST',
                    body: { fileId: currentVideoFile.id, format, bitrate }
                });
                hideOperationLoader();
                showToast(`Extracted ${format.toUpperCase()} audio successfully!`, 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Audio extraction failed.', 'error');
            }
        });
    }

    // 3. Convert Video Format
    const btnConvert = document.getElementById('btn-convert-video');
    if (btnConvert) {
        btnConvert.addEventListener('click', async () => {
            if (!currentVideoFile) return showToast('Please select a video first.', 'warning');
            const format = document.getElementById('vid-convert-format')?.value || 'mp4';

            showOperationLoader({
                title: 'Converting Video Format',
                subtitle: `Transmuxing and transcoding to ${format.toUpperCase()}...`,
                stages: ['Checking container streams...', `Encoding to ${format.toUpperCase()}...`, 'Saving converted video...']
            });

            try {
                const res = await apiFetch('/api/media/convert-video', {
                    method: 'POST',
                    body: { fileId: currentVideoFile.id, format }
                });
                hideOperationLoader();
                showToast(`Converted to ${format.toUpperCase()} successfully!`, 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Conversion failed.', 'error');
            }
        });
    }

    // 4. Resize Video Resolution
    const btnResize = document.getElementById('btn-resize-video');
    if (btnResize) {
        btnResize.addEventListener('click', async () => {
            if (!currentVideoFile) return showToast('Please select a video first.', 'warning');
            const resolution = document.getElementById('vid-scale-target')?.value || '720p';

            showOperationLoader({
                title: 'Rescaling Video Resolution',
                subtitle: `Downscaling video stream to ${resolution}...`,
                stages: ['Resampling video frame buffers...', 'Encoding scaled video frames...', 'Exporting resized video...']
            });

            try {
                const res = await apiFetch('/api/media/compress-video', {
                    method: 'POST',
                    body: { fileId: currentVideoFile.id, resolution }
                });
                hideOperationLoader();
                showToast('Video resolution scaled successfully!', 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Resize failed.', 'error');
            }
        });
    }

    // 5. Trim Video
    const btnTrim = document.getElementById('btn-trim-video');
    if (btnTrim) {
        btnTrim.addEventListener('click', async () => {
            if (!currentVideoFile) return showToast('Please select a video first.', 'warning');

            const startTime = parseFloat(document.getElementById('vid-trim-start')?.value || 0);
            const endTime = parseFloat(document.getElementById('vid-trim-end')?.value || 10);

            if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
                return showToast('Please enter a valid start and end time.', 'warning');
            }

            showOperationLoader({
                title: 'Trimming Video Duration',
                subtitle: `Clipping segment from ${startTime}s to ${endTime}s...`,
                stages: ['Seeking I-frame keyframes...', 'Slicing packet stream...', 'Saving trimmed video...']
            });

            try {
                const res = await apiFetch('/api/media/trim-video', {
                    method: 'POST',
                    body: { fileId: currentVideoFile.id, startTime, endTime }
                });
                hideOperationLoader();
                showToast('Video trimmed successfully!', 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Trim failed.', 'error');
            }
        });
    }

    // 6. Video to GIF
    const btnGif = document.getElementById('btn-gif-video');
    if (btnGif) {
        btnGif.addEventListener('click', async () => {
            if (!currentVideoFile) return showToast('Please select a video first.', 'warning');
            const fps = parseInt(document.getElementById('vid-gif-fps')?.value, 10) || 12;

            showOperationLoader({
                title: 'Converting Video to GIF',
                subtitle: `Generating animated palette at ${fps} FPS...`,
                stages: ['Generating 256-color palette...', 'Extracting video frames...', 'Encoding animated GIF...']
            });

            try {
                const res = await apiFetch('/api/media/video-to-gif', {
                    method: 'POST',
                    body: { fileId: currentVideoFile.id, fps }
                });
                hideOperationLoader();
                showToast('GIF created successfully!', 'success');
                if (res.result) DocholderStorage.addRecentFile(res.result);
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'GIF conversion failed.', 'error');
            }
        });
    }

    // 7. Merge Videos
    const btnMerge = document.getElementById('btn-apply-video-merge');
    if (btnMerge) {
        btnMerge.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.video-merge-checkbox:checked');
            const fileIds = Array.from(checkedBoxes).map(b => b.value);

            if (fileIds.length < 2) {
                return showToast('Please select at least 2 video files to merge.', 'warning');
            }

            showOperationLoader({
                title: 'Merging Video Streams',
                subtitle: `Combining ${fileIds.length} video clips...`,
                stages: ['Demuxing video streams...', 'Conforming frame dimensions...', 'Fusing video tracks with H.264...', 'Generating output MP4...']
            });

            try {
                const res = await apiFetch('/api/media/merge-video', {
                    method: 'POST',
                    body: { fileIds }
                });
                hideOperationLoader();
                showToast('Videos merged successfully!', 'success');
                if (res.result) DocholderStorage.addRecentFile(res.result);
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Video merge failed.', 'error');
            }
        });
    }
}

function displayResult(result) {
    const card = document.getElementById('video-result-card');
    if (!card) return;
    card.classList.remove('hidden');
    if (window.DocholderAudio) window.DocholderAudio.playSuccess();

    document.getElementById('vid-before-val').textContent = formatBytes(result.originalSize);
    document.getElementById('vid-after-val').textContent = formatBytes(result.convertedSize);
    document.getElementById('vid-result-saved').textContent = `${result.percentageSaved || 0}% Saved`;

    const mediaCont = document.getElementById('vid-result-media-container');
    if (mediaCont) {
        const isAudio = ['mp3', 'wav', 'aac', 'ogg'].some(ext => result.originalName.endsWith('.' + ext));
        const isGif = result.originalName.endsWith('.gif');

        if (isAudio) {
            mediaCont.innerHTML = `<audio controls src="${result.downloadUrl}?inline=true" style="width:100%;"></audio>`;
        } else if (isGif) {
            mediaCont.innerHTML = `<img src="${result.downloadUrl}?inline=true" style="max-height:200px;object-fit:contain;">`;
        } else {
            mediaCont.innerHTML = `<video controls preload="metadata" src="${result.downloadUrl}?inline=true" style="max-height:200px;width:100%;"></video>`;
        }
    }

    const dl = document.getElementById('vid-download-link');
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

