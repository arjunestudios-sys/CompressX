// Docholder Conversational Assistant & Pipeline Client Logic

class DocholderAssistant {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = options;
        this.selectedFile = null;
        this.messages = [];
        this.voiceEnabled = localStorage.getItem('aura_voice_enabled') === 'true';
        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
        this.attachEventListeners();
        this.addAssistantMessage("Greetings. I am **AURA // NEXUS-9**, your quantum AI copilot. Drop any asset into the workspace, or transmit commands like */quantum-compress*, */extract-audio*, or *'Convert to WebP'*.");
    }

    render() {
        this.container.innerHTML = `
            <div class="assistant-panel glass-card cyber-card" style="margin-bottom: 12px; padding: 14px;">
                <div class="assistant-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="aura-orb-wrapper">
                            <div class="aura-orb"></div>
                            <div class="aura-orb-ring"></div>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-family: var(--font-hud); font-size: 0.85rem; font-weight: 800; color: var(--cyan-neon); letter-spacing: 0.8px;">AURA // COPILOT</span>
                                <span class="hud-badge hud-badge-green" style="font-size: 0.55rem; padding: 1px 5px;">ONLINE</span>
                            </div>
                            <div style="font-size: 0.66rem; color: var(--text-secondary); font-family: var(--font-mono);">SYNAPSE CORE v4.2</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" id="aura-voice-toggle" class="icon-btn" title="Toggle AI Voice Synth" style="width: 28px; height: 28px; color: ${this.voiceEnabled ? 'var(--cyan-neon)' : 'var(--text-muted)'}; font-size: 0.78rem;">
                            <i class="${this.voiceEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark'}"></i>
                        </button>
                        <div id="assistant-file-tag" class="hidden" style="font-size: 0.68rem; background: rgba(0, 240, 255, 0.12); color: var(--cyan-neon); border: 1px solid rgba(0, 240, 255, 0.3); padding: 2px 8px; border-radius: 20px; max-width: 120px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-family: var(--font-mono);"></div>
                    </div>
                </div>

                <div id="assistant-messages-list" class="assistant-messages" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 4px 0;"></div>

                <!-- Action Suggestions Bar -->
                <div id="assistant-suggestions" class="action-chips" style="padding: 6px 0 8px 0; margin: 0; overflow-x: auto; scrollbar-width: none;">
                    <button class="action-chip" data-prompt="Convert this to PDF"><i class="fa-solid fa-file-pdf" style="color:var(--danger);"></i> To PDF</button>
                    <button class="action-chip" data-prompt="Make it smaller"><i class="fa-solid fa-compress" style="color:var(--emerald-neon);"></i> Compress</button>
                    <button class="action-chip" data-prompt="Extract audio as MP3"><i class="fa-solid fa-music" style="color:var(--magenta-neon);"></i> Extract MP3</button>
                    <button class="action-chip" data-prompt="Prepare for email"><i class="fa-solid fa-envelope" style="color:var(--amber-neon);"></i> For Email</button>
                </div>

                <form id="assistant-input-form" class="assistant-input-form" style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" id="assistant-attach-btn" class="icon-btn" title="Attach file" style="width: 34px; height: 34px; color: var(--cyan-neon);"><i class="fa-solid fa-paperclip"></i></button>
                    <input type="file" id="assistant-file-picker" class="hidden">
                    <input type="text" id="assistant-text-input" class="form-input" style="flex: 1; height: 36px; font-size: 0.8rem; padding: 6px 12px; font-family: var(--font-family);" placeholder="Transmit instruction to AURA..." autocomplete="off">
                    <button type="submit" class="btn btn-primary btn-sm" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-arrow-up"></i></button>
                </form>
            </div>
        `;
    }

    attachEventListeners() {
        const form = this.container.querySelector('#assistant-input-form');
        const input = this.container.querySelector('#assistant-text-input');
        const attachBtn = this.container.querySelector('#assistant-attach-btn');
        const filePicker = this.container.querySelector('#assistant-file-picker');
        const suggestionsContainer = this.container.querySelector('#assistant-suggestions');
        const voiceBtn = this.container.querySelector('#aura-voice-toggle');

        if (voiceBtn) {
            voiceBtn.onclick = () => {
                this.voiceEnabled = !this.voiceEnabled;
                localStorage.setItem('aura_voice_enabled', this.voiceEnabled ? 'true' : 'false');
                voiceBtn.innerHTML = `<i class="${this.voiceEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark'}"></i>`;
                voiceBtn.style.color = this.voiceEnabled ? 'var(--cyan-neon)' : 'var(--text-muted)';
                if (this.voiceEnabled && window.CyberVoice) {
                    window.CyberVoice.speak("Neural voice synthesizer active.");
                }
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const text = input.value.trim();
                if (!text) return;
                input.value = '';
                await this.handleUserQuery(text);
            };
        }

        if (attachBtn && filePicker) {
            attachBtn.onclick = () => filePicker.click();
            filePicker.onchange = async () => {
                if (filePicker.files.length > 0) {
                    await this.handleDirectFileUpload(filePicker.files[0]);
                }
            };
        }

        if (suggestionsContainer) {
            suggestionsContainer.onclick = (e) => {
                const chip = e.target.closest('.action-chip');
                if (chip) {
                    const prompt = chip.getAttribute('data-prompt');
                    if (prompt) {
                        this.handleUserQuery(prompt);
                    }
                }
            };
        }
    }

    setAttachedFile(fileObj) {
        this.selectedFile = fileObj;
        const tag = this.container.querySelector('#assistant-file-tag');
        if (tag) {
            if (fileObj) {
                tag.textContent = `📎 ${fileObj.original_name || fileObj.name}`;
                tag.classList.remove('hidden');
                this.updateSuggestionsForFile(fileObj.original_name || fileObj.name);
            } else {
                tag.classList.add('hidden');
            }
        }
    }

    updateSuggestionsForFile(fileName) {
        const ext = (fileName || '').split('.').pop().toLowerCase();
        const suggestionsContainer = this.container.querySelector('#assistant-suggestions');
        if (!suggestionsContainer) return;

        let chipsHtml = '';
        if (ext === 'pdf') {
            chipsHtml = `
                <button class="action-chip" data-prompt="Convert this to Word"><i class="fa-solid fa-file-word" style="color:#3b82f6;"></i> To Word</button>
                <button class="action-chip" data-prompt="Compress this PDF to under 2MB"><i class="fa-solid fa-compress" style="color:#10b981;"></i> Under 2MB</button>
                <button class="action-chip" data-prompt="Split this PDF"><i class="fa-solid fa-scissors" style="color:#f59e0b;"></i> Split</button>
                <button class="action-chip" data-prompt="Prepare for email"><i class="fa-solid fa-envelope"></i> For Email</button>
            `;
        } else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
            chipsHtml = `
                <button class="action-chip" data-prompt="Extract audio as MP3"><i class="fa-solid fa-music" style="color:#ec4899;"></i> Extract MP3</button>
                <button class="action-chip" data-prompt="Compress this video"><i class="fa-solid fa-compress" style="color:#10b981;"></i> Compress Video</button>
                <button class="action-chip" data-prompt="Convert video to GIF"><i class="fa-solid fa-film" style="color:#14b8a6;"></i> To GIF</button>
            `;
        } else if (['jpg', 'jpeg', 'png', 'webp', 'tiff'].includes(ext)) {
            chipsHtml = `
                <button class="action-chip" data-prompt="Convert to WebP"><i class="fa-solid fa-image" style="color:#06b6d4;"></i> To WebP</button>
                <button class="action-chip" data-prompt="Make smaller than 500KB"><i class="fa-solid fa-compress" style="color:#10b981;"></i> Under 500KB</button>
                <button class="action-chip" data-prompt="Convert to PDF"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> To PDF</button>
            `;
        } else {
            chipsHtml = `
                <button class="action-chip" data-prompt="Make it smaller"><i class="fa-solid fa-compress" style="color:#10b981;"></i> Compress</button>
                <button class="action-chip" data-prompt="Convert to PDF"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> To PDF</button>
            `;
        }
        suggestionsContainer.innerHTML = chipsHtml;
    }

    async handleDirectFileUpload(file) {
        showToast(`Uploading ${file.name}...`, 'info');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await apiFetch('/api/files/upload', { method: 'POST', body: formData });
            this.setAttachedFile(res.file);
            this.addAssistantMessage(`Uploaded **${res.file.original_name}** (${formatBytes(res.file.file_size)}). What should we do with it?`);
            showToast('File attached!', 'success');
        } catch(e) {
            showToast(e.message || 'Upload failed', 'error');
        }
    }

    addUserMessage(text) {
        const list = this.container.querySelector('#assistant-messages-list');
        const bubble = document.createElement('div');
        bubble.style.background = 'var(--primary-light)';
        bubble.style.color = 'var(--primary)';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = 'var(--radius-xs)';
        bubble.style.alignSelf = 'flex-end';
        bubble.style.maxWidth = '85%';
        bubble.style.fontSize = '0.8rem';
        bubble.textContent = text;
        list.appendChild(bubble);
        list.scrollTop = list.scrollHeight;
    }

    addAssistantMessage(markdownText, resultData = null) {
        const list = this.container.querySelector('#assistant-messages-list');
        const bubble = document.createElement('div');
        bubble.style.background = 'var(--surface-card)';
        bubble.style.border = '1px solid var(--surface-border)';
        bubble.style.padding = '10px 14px';
        bubble.style.borderRadius = 'var(--radius-sm)';
        bubble.style.alignSelf = 'flex-start';
        bubble.style.maxWidth = '92%';
        bubble.style.fontSize = '0.82rem';
        bubble.style.boxShadow = '0 0 10px rgba(0, 240, 255, 0.08)';

        if (window.DocholderAudio) window.DocholderAudio.playClick();
        if (this.voiceEnabled && window.CyberVoice) window.CyberVoice.speak(markdownText);

        let html = markdownText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        bubble.innerHTML = html;

        if (resultData) {
            const card = document.createElement('div');
            card.style.marginTop = '8px';
            card.style.padding = '8px';
            card.style.background = 'var(--surface-hover)';
            card.style.borderRadius = 'var(--radius-xs)';
            card.style.border = '1px solid var(--surface-border)';

            card.innerHTML = `
                <div style="font-weight: 700; font-size: 0.8rem; margin-bottom: 4px; word-break: break-all;">
                    📄 ${resultData.originalName}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary);">${formatBytes(resultData.convertedSize || resultData.fileSize)}</span>
                    ${resultData.percentageSaved > 0 ? `<span class="savings-badge" style="font-size: 0.68rem; padding: 2px 6px;">${resultData.percentageSaved}% Saved</span>` : ''}
                </div>
                <a href="${resultData.downloadUrl}" class="btn btn-primary btn-sm" style="width: 100%; font-size: 0.75rem; padding: 4px 8px;"><i class="fa-solid fa-download"></i> Download</a>
            `;

            bubble.appendChild(card);
        }

        list.appendChild(bubble);
        list.scrollTop = list.scrollHeight;
    }

    async handleUserQuery(query) {
        this.addUserMessage(query);

        const list = this.container.querySelector('#assistant-messages-list');
        const typingEl = document.createElement('div');
        typingEl.style.fontSize = '0.78rem';
        typingEl.style.color = 'var(--text-secondary)';
        typingEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary);"></i> Executing pipeline...`;
        list.appendChild(typingEl);
        list.scrollTop = list.scrollHeight;

        try {
            const body = {
                query,
                fileId: this.selectedFile ? this.selectedFile.id : null
            };

            const data = await apiFetch('/api/convert/assistant-query', {
                method: 'POST',
                body
            });

            typingEl.remove();
            this.addAssistantMessage(data.reply, data.result);
            if (data.result) {
                showToast(`Task executed successfully!`, 'success');
            }
        } catch(err) {
            typingEl.remove();
            this.addAssistantMessage(`Sorry, I couldn't complete that request: ${err.message}`);
            showToast('Action failed. Please check the file and try again.', 'error');
        }
    }
}

// Auto instantiate on dashboard
document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('docholder-assistant-container');
    if (el) {
        window.docholderAssistant = new DocholderAssistant('docholder-assistant-container');
    }
});
