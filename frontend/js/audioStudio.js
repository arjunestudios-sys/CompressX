/**
 * Docholder Audio Studio Client Logic
 */

let currentAudioFile = null;
let workspaceAudios = [];
let lastTranscription = null;

const AUDIO_MODE_TITLES = {
    convert: 'Convert Audio Format',
    volume: 'Adjust Audio Volume',
    merge: 'Merge Audio Tracks',
    compress: 'Compress Audio Track',
    trim: 'Trim Audio Duration',
    transcribe: 'Transcribe Audio to Text'
};

document.addEventListener('DOMContentLoaded', async () => {
    setupModeChips();
    setupDropzone();
    setupControls();
    await loadWorkspaceAudios();

    // Restore workspace state if available
    const savedState = getWorkspaceState('audio_studio');
    const params = new URLSearchParams(window.location.search);
    const initialTool = params.get('tool') || (savedState ? savedState.mode : 'convert');
    switchMode(initialTool);

    const initialFileId = params.get('fileId') || (savedState ? savedState.fileId : null);
    if (initialFileId) {
        const sel = document.getElementById('audio-file-select');
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
    const panels = ['convert', 'volume', 'merge', 'compress', 'trim', 'transcribe'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`panel-${mode}`);
    if (activeEl) activeEl.classList.remove('hidden');

    const titleEl = document.querySelector('.page-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-music" style="color: #10B981;"></i> ${AUDIO_MODE_TITLES[mode] || 'Audio Studio'}`;
    }
    const headerTitle = document.querySelector('.mobile-header-title span');
    if (headerTitle) {
        headerTitle.textContent = AUDIO_MODE_TITLES[mode] || 'Audio Studio';
    }

    document.querySelectorAll('.category-nav-bar .action-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === mode);
    });

    saveWorkspaceState('audio_studio', {
        mode,
        fileId: currentAudioFile ? currentAudioFile.id : null
    });
}

async function loadWorkspaceAudios() {
    try {
        const data = await apiFetch('/api/files?category=audio');
        const audExts = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac', '.wma', '.aiff'];
        workspaceAudios = (data.files || []).filter(f => {
            const name = (f.original_name || '').toLowerCase();
            return (f.mime_type && f.mime_type.startsWith('audio/')) || audExts.some(ext => name.endsWith(ext));
        });
        const select = document.getElementById('audio-file-select');
        if (select) {
            select.innerHTML = '<option value="">-- Choose from Workspace --</option>';
            workspaceAudios.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.original_name} (${formatBytes(f.file_size)})`;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                const fId = e.target.value;
                if (!fId) {
                    currentAudioFile = null;
                    document.getElementById('selected-audio-preview-container').classList.add('hidden');
                    return;
                }
                currentAudioFile = workspaceAudios.find(f => String(f.id) === String(fId)) || null;
                if (currentAudioFile) renderSelectedAudio(currentAudioFile);
                
                saveWorkspaceState('audio_studio', {
                    mode: document.querySelector('.action-chip.active')?.getAttribute('data-mode') || 'convert',
                    fileId: fId
                });
            });
        }
        renderAudioMultiList();
    } catch(e) {}
}

function renderAudioMultiList() {
    const list = document.getElementById('audio-multi-select-list');
    if (!list) return;
    if (workspaceAudios.length === 0) {
        list.innerHTML = '<div style="font-size:0.75rem; color:var(--text-secondary);">No audio files found in workspace.</div>';
        return;
    }
    list.innerHTML = workspaceAudios.map(f => `
        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; background:var(--surface); padding:6px 10px; border-radius:var(--radius-xs); border:1px solid var(--surface-border); cursor:pointer;">
            <input type="checkbox" class="audio-merge-checkbox" value="${f.id}" checked>
            <i class="fa-solid fa-file-audio" style="color:#10B981;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.original_name}</span>
            <span style="color:var(--text-secondary); font-size:0.72rem;">${formatBytes(f.file_size)}</span>
        </label>
    `).join('');
}

async function renderSelectedAudio(file) {
    const prevContainer = document.getElementById('selected-audio-preview-container');
    const player = document.getElementById('selected-audio-player');
    const metaBadge = document.getElementById('selected-audio-meta-badge');
    if (prevContainer && player) {
        prevContainer.classList.remove('hidden');
        const rawAudioUrl = `/api/files/${file.id}/download?inline=true`;
        player.src = (typeof resolveApiUrl === 'function') ? resolveApiUrl(rawAudioUrl) : rawAudioUrl;
        if (metaBadge) metaBadge.textContent = `${file.original_name} • ${formatBytes(file.file_size)}`;

        initAudioVisualizer();

        try {
            const ext = (file.original_name || '').split('.').pop().toUpperCase();
            const fmtBadge = document.getElementById('transcribe-fmt-badge');
            if (fmtBadge) fmtBadge.textContent = ext || 'AUDIO';

            const metaRes = await apiFetch(`/api/media/metadata/${file.id}`);
            if (metaRes && metaRes.metadata) {
                if (metaRes.metadata.durationFormatted && metaBadge) {
                    metaBadge.textContent = `${file.original_name} (${metaRes.metadata.durationFormatted} • ${formatBytes(file.file_size)})`;
                }
                const bitBadge = document.getElementById('transcribe-bitrate-badge');
                if (bitBadge && metaRes.metadata.bitrate) {
                    bitBadge.textContent = `${Math.round(metaRes.metadata.bitrate / 1000)} kbps`;
                }
            }
            // Heavy File Inspector (Requirement 10)
            const dropzone = document.getElementById('audio-dropzone');
            if (dropzone && typeof renderHeavyFileInspector === 'function') {
                renderHeavyFileInspector(dropzone, file, { mediaType: 'audio', duration: metaRes?.metadata?.duration });
            }
        } catch(e) {}
    }
}

function setupDropzone() {
    const dropzone = document.getElementById('audio-dropzone');
    const input = document.getElementById('audio-file-input');
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
            await handleAudioUpload(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            await handleAudioUpload(e.target.files[0]);
        }
    });
}

async function handleAudioUpload(fileObj) {
    const dropzone = document.getElementById('audio-dropzone');
    const tracker = typeof renderFileUploadTracker === 'function' ? renderFileUploadTracker(dropzone, fileObj) : null;

    try {
        if (tracker) tracker.update(25, 'Loading audio track... 25%', 'Est: ~1s');
        await new Promise(r => setTimeout(r, 80));

        if (tracker) tracker.update(55, 'Uploading audio buffer... 55%', 'Est: ~1s');

        const res = await uploadFileWithProgress('/api/files/upload', fileObj, (p) => {
            if (tracker && p.percent) {
                const scaled = Math.min(88, Math.max(25, Math.round(p.percent * 0.88)));
                tracker.update(scaled, `Uploading audio buffer... ${scaled}%`);
            }
        });

        if (tracker) tracker.update(95, 'Probing bitrate & channels... 95%');
        await new Promise(r => setTimeout(r, 60));

        if (tracker) tracker.ready(fileObj.name);
        showToast('Audio uploaded successfully!', 'success');
        await loadWorkspaceAudios();
        
        const select = document.getElementById('audio-file-select');
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
    // 1. Convert Audio
    const btnConvert = document.getElementById('btn-convert-audio');
    if (btnConvert) {
        btnConvert.addEventListener('click', async () => {
            if (!currentAudioFile) return showToast('Please select an audio file first.', 'warning');
            
            const format = document.getElementById('aud-target-format')?.value || 'mp3';
            const bitrate = document.getElementById('aud-target-bitrate')?.value || '192k';

            showOperationLoader({
                title: 'Converting Audio Format',
                subtitle: `Transcoding to ${format.toUpperCase()} (${bitrate})...`,
                stages: ['Decoding audio streams...', `Encoding ${format.toUpperCase()} audio...`, 'Finalizing audio track...']
            });

            try {
                const res = await apiFetch('/api/media/convert-audio', {
                    method: 'POST',
                    body: { fileId: currentAudioFile.id, format, bitrate }
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

    // 2. Compress Audio
    const btnCompress = document.getElementById('btn-compress-audio');
    if (btnCompress) {
        btnCompress.addEventListener('click', async () => {
            if (!currentAudioFile) return showToast('Please select an audio file first.', 'warning');
            
            const bitrate = document.getElementById('aud-compress-bitrate')?.value || '128k';
            const mono = document.getElementById('aud-compress-mono')?.checked === true;

            showOperationLoader({
                title: 'Compressing Audio',
                subtitle: `Re-encoding bitrate to ${bitrate}${mono ? ' (Mono)' : ''}...`,
                stages: ['Analyzing acoustic frequency spectrum...', 'Optimizing bitrate & sample rate...', 'Exporting compressed audio...']
            });

            try {
                const res = await apiFetch('/api/media/compress-audio', {
                    method: 'POST',
                    body: { fileId: currentAudioFile.id, bitrate, mono }
                });
                hideOperationLoader();
                showToast('Audio compressed successfully!', 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Compression failed.', 'error');
            }
        });
    }

    // Volume adjustment slider
    const volRange = document.getElementById('aud-volume-range');
    const volVal = document.getElementById('aud-volume-val');
    if (volRange && volVal) {
        volRange.addEventListener('input', (e) => {
            volVal.textContent = `${e.target.value}%`;
        });
    }

    // Apply Volume
    const btnVolume = document.getElementById('btn-apply-volume');
    if (btnVolume) {
        btnVolume.addEventListener('click', async () => {
            if (!currentAudioFile) return showToast('Please select an audio file first.', 'warning');
            const volumePercent = parseInt(document.getElementById('aud-volume-range')?.value || '100', 10);

            showOperationLoader({
                title: 'Adjusting Audio Volume',
                subtitle: `Applying ${volumePercent}% amplitude filter...`,
                stages: ['Loading audio waveform stream...', 'Modulating decibel gain...', 'Encoding output MP3...']
            });

            try {
                const res = await apiFetch('/api/media/volume-audio', {
                    method: 'POST',
                    body: { fileId: currentAudioFile.id, volumePercent }
                });
                hideOperationLoader();
                showToast(`Volume adjusted to ${volumePercent}%!`, 'success');
                if (res.result) DocholderStorage.addRecentFile(res.result);
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Volume adjustment failed.', 'error');
            }
        });
    }

    // Merge Audio Tracks
    const btnMerge = document.getElementById('btn-apply-audio-merge');
    if (btnMerge) {
        btnMerge.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.audio-merge-checkbox:checked');
            const fileIds = Array.from(checkedBoxes).map(b => b.value);

            if (fileIds.length < 2) {
                return showToast('Please select at least 2 audio tracks to merge.', 'warning');
            }

            showOperationLoader({
                title: 'Merging Audio Tracks',
                subtitle: `Combining ${fileIds.length} audio files...`,
                stages: ['Decoding audio streams...', 'Synchronizing sampling rates...', 'Fusing tracks with ffmpeg concat...', 'Finalizing output...']
            });

            try {
                const res = await apiFetch('/api/media/merge-audio', {
                    method: 'POST',
                    body: { fileIds }
                });
                hideOperationLoader();
                showToast('Audio tracks merged successfully!', 'success');
                if (res.result) DocholderStorage.addRecentFile(res.result);
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Audio merge failed.', 'error');
            }
        });
    }

    // 3. Trim Audio
    const btnTrim = document.getElementById('btn-trim-audio');
    if (btnTrim) {
        btnTrim.addEventListener('click', async () => {
            if (!currentAudioFile) return showToast('Please select an audio file first.', 'warning');

            const startTime = parseFloat(document.getElementById('aud-trim-start')?.value || 0);
            const endTime = parseFloat(document.getElementById('aud-trim-end')?.value || 30);

            if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
                return showToast('Please enter a valid start and end time.', 'warning');
            }

            showOperationLoader({
                title: 'Trimming Audio Track',
                subtitle: `Clipping segment from ${startTime}s to ${endTime}s...`,
                stages: ['Seeking audio timestamp...', 'Slicing audio packet buffer...', 'Saving trimmed track...']
            });

            try {
                const res = await apiFetch('/api/media/trim-audio', {
                    method: 'POST',
                    body: { fileId: currentAudioFile.id, startTime, endTime }
                });
                hideOperationLoader();
                showToast('Audio trimmed successfully!', 'success');
                displayResult(res.result);
            } catch(err) {
                hideOperationLoader();
                showToast(err.message || 'Trim failed.', 'error');
            }
        });
    }

    // 4. Transcribe Audio (Speech to Text)
    const btnTranscribe = document.getElementById('btn-start-transcribe') || document.getElementById('btn-transcribe-audio');
    if (btnTranscribe) {
        btnTranscribe.addEventListener('click', async () => {
            if (!currentAudioFile) return showToast('Please select an audio file to transcribe.', 'warning');

            const language = document.getElementById('transcribe-language')?.value || 'en';
            const progressWrapper = document.getElementById('transcribe-progress-wrapper');
            const progressFill = document.getElementById('transcribe-progress-fill');
            const progressStatus = document.getElementById('transcribe-progress-status');
            const progressPercent = document.getElementById('transcribe-progress-percent');

            if (progressWrapper) progressWrapper.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '15%';
            if (progressPercent) progressPercent.textContent = '15%';
            if (progressStatus) progressStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading audio stream...';

            btnTranscribe.disabled = true;

            const stages = [
                { pct: 30, text: 'Preparing transcription parameters...' },
                { pct: 55, text: 'Transcribing neural audio speech chunks...' },
                { pct: 75, text: 'Aligning timecodes and sentence boundaries...' },
                { pct: 90, text: 'Finalizing formatted transcript...' }
            ];

            let stageIdx = 0;
            let tTimer = setInterval(() => {
                if (stageIdx < stages.length && progressPercent && progressFill && progressStatus) {
                    const st = stages[stageIdx];
                    progressPercent.textContent = `${st.pct}%`;
                    progressFill.style.width = `${st.pct}%`;
                    progressStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${st.text}`;
                    stageIdx++;
                }
            }, 300);

            try {
                const res = await apiFetch('/api/media/transcribe-audio', {
                    method: 'POST',
                    body: { fileId: currentAudioFile.id, language }
                });

                clearInterval(tTimer);
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressFill) progressFill.style.width = '100%';
                if (progressStatus) progressStatus.textContent = 'Transcription complete ✓';

                showToast('Audio transcribed successfully!', 'success');

                lastTranscription = res.result;
                const prevBox = document.getElementById('transcript-preview-box');
                const textArea = document.getElementById('transcript-text-area');
                const wordCountBadge = document.getElementById('transcript-word-count');

                if (prevBox && textArea && res.result) {
                    prevBox.classList.remove('hidden');
                    textArea.value = res.result.transcriptText || '';
                    if (wordCountBadge) {
                        wordCountBadge.textContent = `${res.result.wordCount || 0} words • ${res.result.charCount || 0} chars`;
                    }
                    prevBox.scrollIntoView({ behavior: 'smooth' });
                }
            } catch(e) {
                clearInterval(tTimer);
                showToast(e.message || 'Transcription failed.', 'error');
            } finally {
                btnTranscribe.disabled = false;
                setTimeout(() => {
                    if (progressWrapper) progressWrapper.classList.add('hidden');
                }, 2000);
            }
        });
    }

    // Copy Transcript to Clipboard
    const btnCopy = document.getElementById('btn-copy-transcript');
    if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
            const text = document.getElementById('transcript-text-area')?.value;
            if (!text || !text.trim()) return showToast('No transcript text to copy.', 'warning');
            try {
                await navigator.clipboard.writeText(text);
                showToast('Transcript text copied to clipboard! ✓', 'success');
                btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    btnCopy.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Text';
                }, 2000);
            } catch (err) {
                const ta = document.getElementById('transcript-text-area');
                if (ta) {
                    ta.select();
                    document.execCommand('copy');
                    showToast('Transcript text copied to clipboard! ✓', 'success');
                }
            }
        });
    }

    // Export Transcript buttons (TXT, DOCX, PDF)
    const btnExportTxt = document.getElementById('btn-export-txt');
    const btnExportDocx = document.getElementById('btn-export-docx');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    if (btnExportTxt) btnExportTxt.addEventListener('click', () => exportTranscriptFile('txt'));
    if (btnExportDocx) btnExportDocx.addEventListener('click', () => exportTranscriptFile('docx'));
    if (btnExportPdf) btnExportPdf.addEventListener('click', () => exportTranscriptFile('pdf'));

    async function exportTranscriptFile(format) {
        if (!currentAudioFile) return showToast('Please select an audio file first.', 'warning');
        const text = document.getElementById('transcript-text-area')?.value;
        if (!text || !text.trim()) return showToast('Transcript text is empty.', 'warning');

        showOperationLoader({
            title: `Exporting Transcript to ${format.toUpperCase()}`,
            subtitle: 'Formatting and building document...',
            stages: ['Parsing transcript text...', `Rendering ${format.toUpperCase()} document...`, 'Generating downloadable file...']
        });

        try {
            const res = await apiFetch('/api/media/export-transcript', {
                method: 'POST',
                body: {
                    fileId: currentAudioFile.id,
                    transcriptText: text,
                    format
                }
            });
            hideOperationLoader();
            showToast(`Transcript exported to ${format.toUpperCase()}!`, 'success');
            displayResult(res.result);
        } catch(e) {
            hideOperationLoader();
            showToast(e.message || 'Export failed.', 'error');
        }
    }
}

function displayResult(result) {
    const card = document.getElementById('audio-result-card');
    if (!card) return;
    card.classList.remove('hidden');

    const beforeVal = document.getElementById('aud-before-val');
    const afterVal = document.getElementById('aud-after-val');
    const savedBadge = document.getElementById('aud-result-saved');

    if (beforeVal) beforeVal.textContent = formatBytes(result.originalSize || result.fileSize || 0);
    if (afterVal) afterVal.textContent = formatBytes(result.convertedSize || result.fileSize || 0);
    if (savedBadge) savedBadge.textContent = `${result.percentageSaved || 0}% Saved`;

    const player = document.getElementById('aud-result-player');
    if (player && (result.originalName.endsWith('.mp3') || result.originalName.endsWith('.wav') || result.originalName.endsWith('.ogg'))) {
        player.src = `${result.downloadUrl}?inline=true`;
    }

    const dl = document.getElementById('aud-download-link');
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

// Real-time Web Audio API Oscilloscope & Spectrum Visualizer Engine
let audioVisualizerInitialized = false;
let audioAnalyser = null;
let audioSourceNode = null;

function initAudioVisualizer() {
    const canvas = document.getElementById('audio-waveform-canvas');
    const player = document.getElementById('selected-audio-player');
    if (!canvas || !player || audioVisualizerInitialized) return;

    canvas.width = canvas.parentElement.clientWidth || 380;
    canvas.height = canvas.parentElement.clientHeight || 110;
    const ctx = canvas.getContext('2d');

    player.addEventListener('play', () => {
        try {
            window.DocholderAudio.initContext();
            const actx = window.DocholderAudio.ctx;
            if (actx && !audioAnalyser) {
                audioAnalyser = actx.createAnalyser();
                audioAnalyser.fftSize = 128;
                audioSourceNode = actx.createMediaElementSource(player);
                audioSourceNode.connect(audioAnalyser);
                audioAnalyser.connect(actx.destination);
            }
        } catch(e) {
            // In case node is already connected or security policy, visualizer gracefully continues
        }
    });

    let phase = 0;
    function renderVisualizer() {
        requestAnimationFrame(renderVisualizer);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Futuristic Grid Lines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 22) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        const isPlaying = !player.paused && !player.ended;
        const bufferLength = audioAnalyser ? audioAnalyser.frequencyBinCount : 32;
        const dataArray = new Uint8Array(bufferLength);

        if (isPlaying && audioAnalyser) {
            audioAnalyser.getByteTimeDomainData(dataArray);

            // Primary Neon Cyan Oscilloscope Wave
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = '#00F0FF';
            ctx.shadowColor = '#00F0FF';
            ctx.shadowBlur = 12;
            ctx.beginPath();

            const sliceWidth = canvas.width / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();

            // Secondary Magenta Pulse Wave
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = '#FF007A';
            ctx.shadowColor = '#FF007A';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = (dataArray[i] / 128.0) - 1.0;
                const y = canvas.height / 2 - (v * canvas.height * 0.45);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            // Idle Cyber Ambient Scanwave
            phase += 0.045;
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
            ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
            ctx.shadowBlur = 10;
            ctx.beginPath();

            for (let x = 0; x < canvas.width; x++) {
                const y = canvas.height / 2 + Math.sin(x * 0.035 + phase) * 14 * Math.sin(x * 0.012);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Ambient Echo Line
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(255, 0, 122, 0.5)';
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x++) {
                const y = canvas.height / 2 + Math.cos(x * 0.025 - phase) * 9;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    renderVisualizer();
    audioVisualizerInitialized = true;
}


