/**
 * Docholder All Tools Directory JavaScript
 */

const TOOLS_DIRECTORY = [
    // AI Content & Writing Intelligence
    { id: 'ai-content-tracker', title: 'AI Content Rate Tracker', desc: 'Probabilistic AI-likeness assessment & structural signal analysis', cat: 'ai', icon: 'fa-brain', color: '#8B5CF6', url: 'document-tools.html?tool=ai-detector' },
    { id: 'ai-humanizer', title: 'Smart Humanizer', desc: 'Controlled AI humanization with character limits & before/after diff', cat: 'ai', icon: 'fa-user-pen', color: '#06B6D4', url: 'document-tools.html?tool=humanize' },
    { id: 'doc-understanding', title: 'AI Document Understanding', desc: 'Summary, key findings, dates, action items & entities', cat: 'ai', icon: 'fa-file-circle-check', color: '#EC4899', url: 'document-tools.html?tool=understand' },
    { id: 'doc-chat', title: 'Chat With Any File', desc: 'Universal document Q&A with page & section citations', cat: 'ai', icon: 'fa-comments', color: '#3B82F6', url: 'document-tools.html?tool=chat' },
    { id: 'cross-file-intelligence', title: 'Cross-File Intelligence', desc: 'Compare facts, revenue data & discrepancies across multiple files', cat: 'ai', icon: 'fa-network-wired', color: '#8B5CF6', url: 'document-tools.html?tool=cross-intelligence' },
    { id: 'doc-fact-checker', title: 'Document Fact Checker', desc: 'Extract and classify claims (Supported, Requires Verification, Unverified)', cat: 'ai', icon: 'fa-check-double', color: '#10B981', url: 'document-tools.html?tool=fact-check' },
    { id: 'ai-file-naming', title: 'AI Automatic File Naming', desc: 'Analyze document contents to suggest standardized names', cat: 'ai', icon: 'fa-tag', color: '#10B981', url: 'document-tools.html?tool=suggest-name' },
    { id: 'doc-classification', title: 'Auto Classification & Tags', desc: 'Classify into Invoices, Contracts, Reports & generate hashtags', cat: 'ai', icon: 'fa-tags', color: '#3B82F6', url: 'document-tools.html?tool=classify' },

    // Privacy & Security
    { id: 'privacy-scanner', title: 'Privacy Risk Scanner', desc: 'Detect sensitive PII (Names, Emails, Phones, Account Numbers)', cat: 'security', icon: 'fa-shield-cat', color: '#EF4444', url: 'document-tools.html?tool=privacy-scan' },
    { id: 'pii-redaction', title: 'Smart PII Redaction', desc: 'Wipe underlying sensitive text and apply blackout overlays', cat: 'security', icon: 'fa-user-shield', color: '#EF4444', url: 'document-tools.html?tool=redact-pii' },
    { id: 'smart-share-links', title: 'Smart Share Links', desc: 'Create secure expiration links (1h/1d/7d) & password protection', cat: 'security', icon: 'fa-link', color: '#06B6D4', url: 'files.html?action=share' },
    { id: 'temporary-vault', title: 'Temporary File Vault', desc: 'Secure temporary workspace with countdown timer & auto-purging', cat: 'security', icon: 'fa-clock-rotate-left', color: '#F59E0B', url: 'files.html?vault=true' },

    // Data & Spreadsheet Intelligence
    { id: 'spreadsheet-intelligence', title: 'Spreadsheet Intelligence', desc: 'Tabular Q&A, highest revenue detection & anomaly analysis', cat: 'data', icon: 'fa-table-cells-large', color: '#10B981', url: 'document-tools.html?tool=spreadsheet-intelligence' },
    { id: 'chart-generator', title: 'Automatic Chart Generator', desc: 'Render Bar, Line, Pie & Trend charts from XLSX/CSV data', cat: 'data', icon: 'fa-chart-pie', color: '#10B981', url: 'document-tools.html?tool=generate-charts' },

    // AI Automation & Recipes
    { id: 'ai-workflow-builder', title: 'AI Workflow Builder', desc: 'Visual node pipeline generation from natural language commands', cat: 'automation', icon: 'fa-diagram-project', color: '#8B5CF6', url: 'dashboard.html' },
    { id: 'automation-recipes', title: 'Reusable Automation Recipes', desc: 'Save, run, edit, duplicate, and delete multi-operation workflows', cat: 'automation', icon: 'fa-cubes', color: '#06B6D4', url: 'dashboard.html' },

    // Documents & PDF
    { id: 'fix-my-file', title: 'One-Click Fix My File', desc: 'Automated repair, optimization, OCR & metadata clean pipeline', cat: 'doc', icon: 'fa-wand-magic-sparkles', color: '#06B6D4', url: 'document-tools.html?tool=fix-everything' },
    { id: 'goal-optimization', title: 'Goal-Based Optimization', desc: 'Presets for Email, Website, Mobile, Print, Archive & Submission', cat: 'doc', icon: 'fa-bullseye', color: '#8B5CF6', url: 'document-tools.html?tool=goal-optimize' },
    { id: 'smart-packaging', title: 'Smart File Packaging', desc: 'Validate, convert, compress, standardize naming & package ZIP', cat: 'doc', icon: 'fa-box-archive', color: '#F59E0B', url: 'document-tools.html?tool=smart-package' },
    { id: 'universal-translation', title: 'Universal Translation', desc: 'Translate documents to Tamil, Hindi, English, French, Spanish, German', cat: 'doc', icon: 'fa-language', color: '#3B82F6', url: 'document-tools.html?tool=translate' },
    { id: 'doc-version-diff', title: 'Document Version Diff', desc: 'Page-by-page comparison showing additions, removals, modifications', cat: 'doc', icon: 'fa-code-compare', color: '#3B82F6', url: 'document-tools.html?tool=diff' },
    { id: 'doc-dna', title: 'Document DNA', desc: 'Deep metadata fingerprint, image/table count, OCR status & hash', cat: 'doc', icon: 'fa-fingerprint', color: '#F59E0B', url: 'document-tools.html?tool=dna' },
    { id: 'doc-health-score', title: 'Document Health Score', desc: 'Calculate 0-100 quality score checking size, OCR & structure', cat: 'doc', icon: 'fa-notes-medical', color: '#EF4444', url: 'document-tools.html?tool=health' },
    { id: 'doc-compress', title: 'PDF Compress', desc: 'Reduce PDF file size with optimal quality', cat: 'doc', icon: 'fa-file-pdf', color: '#EF4444', url: 'document-tools.html?tool=compress' },
    { id: 'doc-merge', title: 'PDF Merge', desc: 'Combine multiple PDF files into one', cat: 'doc', icon: 'fa-object-group', color: '#EF4444', url: 'document-tools.html?tool=merge' },
    { id: 'doc-split', title: 'PDF Split', desc: 'Split pages into individual documents', cat: 'doc', icon: 'fa-scissors', color: '#EF4444', url: 'document-tools.html?tool=split' },
    { id: 'doc-protect', title: 'PDF Protect', desc: 'Lock and encrypt PDF with password', cat: 'doc', icon: 'fa-lock', color: '#EF4444', url: 'document-tools.html?tool=protect' },
    { id: 'doc-redact', title: 'PDF Redact', desc: 'Black out sensitive text or regions', cat: 'doc', icon: 'fa-eraser', color: '#EF4444', url: 'document-tools.html?tool=redact' },
    { id: 'doc-sign', title: 'PDF Sign', desc: 'Add digital signature stamp to PDF', cat: 'doc', icon: 'fa-signature', color: '#EF4444', url: 'document-tools.html?tool=sign' },
    { id: 'doc-pdfa', title: 'PDF → PDF/A', desc: 'Convert to ISO archival conformance', cat: 'doc', icon: 'fa-file-shield', color: '#DC2626', url: 'document-tools.html?tool=pdfa' },

    // Word Tools
    { id: 'word-studio', title: 'Word Studio', desc: 'Edit text, format typography & convert Word docs', cat: 'word', icon: 'fa-file-word', color: '#3B82F6', url: 'word-tools.html' },
    { id: 'word-to-pdf', title: 'Word → PDF', desc: 'Convert DOCX document to high-quality PDF', cat: 'word', icon: 'fa-file-pdf', color: '#3B82F6', url: 'word-tools.html?mode=convert' },
    { id: 'word-to-txt', title: 'Word → Text', desc: 'Extract raw text and copy paragraphs', cat: 'word', icon: 'fa-file-lines', color: '#3B82F6', url: 'word-tools.html?mode=convert' },

    // Images
    { id: 'image-intelligence', title: 'Image Intelligence', desc: 'OCR text extraction, object detection, QR/barcode scanning', cat: 'image', icon: 'fa-eye', color: '#8B5CF6', url: 'image-tools.html?tool=image-intelligence' },
    { id: 'smart-document-scanner', title: 'Smart Document Scanner', desc: 'Perspective correction, background cleanup, shadow reduction, OCR', cat: 'image', icon: 'fa-camera-rotate', color: '#8B5CF6', url: 'image-tools.html?tool=document-scan' },
    { id: 'img-compress', title: 'Compress Image', desc: 'Optimize JPG, PNG, WebP with Target Size', cat: 'image', icon: 'fa-compress', color: '#8B5CF6', url: 'image-tools.html?tool=compress' },
    { id: 'img-resize', title: 'Resize Image', desc: 'Change dimensions, 4K, 1080p, 720p or %', cat: 'image', icon: 'fa-up-right-and-down-left-from-center', color: '#8B5CF6', url: 'image-tools.html?tool=resize' },
    { id: 'img-convert', title: 'Convert Image', desc: 'Convert between JPG, PNG, WEBP, TIFF, BMP', cat: 'image', icon: 'fa-rotate', color: '#8B5CF6', url: 'image-tools.html?tool=convert' },

    // Videos
    { id: 'video-intelligence', title: 'Video Intelligence', desc: 'Transcript, summary, timestamped chapters, and key moments', cat: 'video', icon: 'fa-film', color: '#EC4899', url: 'video-tools.html?tool=video-intelligence' },
    { id: 'subtitle-generator', title: 'Automatic Subtitles', desc: 'Timestamped SRT & VTT subtitle generator with editing', cat: 'video', icon: 'fa-closed-captioning', color: '#EC4899', url: 'video-tools.html?tool=subtitles' },
    { id: 'vid-compress', title: 'Compress Video', desc: 'Reduce video size with target size / CRF', cat: 'video', icon: 'fa-file-video', color: '#EC4899', url: 'video-tools.html?tool=compress' },
    { id: 'vid-extract', title: 'Extract Audio', desc: 'Extract MP3, WAV or AAC from video', cat: 'video', icon: 'fa-music', color: '#EC4899', url: 'video-tools.html?tool=extract' },

    // Audio
    { id: 'meeting-intelligence', title: 'Meeting / Audio Intelligence', desc: 'Transcript, summary, key decisions, action items, participants', cat: 'audio', icon: 'fa-users-gear', color: '#10B981', url: 'audio-tools.html?tool=meeting-intelligence' },
    { id: 'aud-transcribe', title: 'Audio → Text', desc: 'Transcribe speech with TXT, DOCX, and PDF export', cat: 'audio', icon: 'fa-file-lines', color: '#10B981', url: 'audio-tools.html?tool=transcribe' },
    { id: 'aud-convert', title: 'Convert Audio', desc: 'MP3, WAV, AAC, OGG, M4A, FLAC', cat: 'audio', icon: 'fa-file-audio', color: '#10B981', url: 'audio-tools.html?tool=convert' }
];

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const catFromUrl = params.get('cat');
    const savedCat = sessionStorage.getItem('last_tool_category');
    const initialCat = catFromUrl || savedCat || 'all';

    // Activate corresponding filter chip
    const targetChip = document.querySelector(`.category-nav-bar .action-chip[data-cat="${initialCat}"]`);
    if (targetChip) {
        document.querySelectorAll('.category-nav-bar .action-chip').forEach(b => b.classList.remove('active'));
        targetChip.classList.add('active');
    }

    renderToolsDirectory(initialCat);

    // Filter Chips
    document.querySelectorAll('.category-nav-bar .action-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-nav-bar .action-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.getAttribute('data-cat');
            sessionStorage.setItem('last_tool_category', cat);
            const newUrl = cat === 'all' ? 'tools.html' : `tools.html?cat=${encodeURIComponent(cat)}`;
            const searchVal = document.getElementById('tool-search-input')?.value || '';
            renderToolsDirectory(cat, searchVal);
        });
    });

    // Search Input
    const searchInput = document.getElementById('tool-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const activeChip = document.querySelector('.category-nav-bar .action-chip.active');
            const activeCat = activeChip ? activeChip.getAttribute('data-cat') : 'all';
            renderToolsDirectory(activeCat, e.target.value);
        });
    }
});

function renderToolsDirectory(activeCategory = 'all', searchQuery = '') {
    const container = document.getElementById('tools-container');
    if (!container) return;

    const q = (searchQuery || '').toLowerCase().trim();

    let filtered = TOOLS_DIRECTORY;
    if (activeCategory !== 'all') {
        filtered = filtered.filter(t => t.cat === activeCategory);
    }
    if (q) {
        filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-face-frown" style="font-size: 2rem; margin-bottom: 8px;"></i>
                <p>No tools matched your search.</p>
            </div>
        `;
        return;
    }

    // Group by category if "all", else show flat grid
    const categoryLabels = {
        ai: { title: '🧠 AI Writing & Content Intelligence', color: '#8B5CF6' },
        security: { title: '🛡 Privacy & Security Scanner', color: '#EF4444' },
        data: { title: '📊 Spreadsheet & Data Charts', color: '#10B981' },
        automation: { title: '⚡ AI Automation & Recipes', color: '#06B6D4' },
        doc: { title: '📄 Document Operations', color: '#EF4444' },
        word: { title: '📝 Word & Office Studio', color: '#3B82F6' },
        image: { title: '🖼 Image Operations', color: '#8B5CF6' },
        video: { title: '🎥 Video Operations', color: '#EC4899' },
        audio: { title: '🎵 Audio Operations', color: '#10B981' },
        convert: { title: '🔄 Universal Conversion', color: '#06B6D4' },
        compress: { title: '⚡ Compression & Optimization', color: '#F59E0B' },
        archive: { title: '📦 Archive Operations', color: '#EAB308' }
    };

    let html = '';
    const categoriesInList = [...new Set(filtered.map(t => t.cat))];

    categoriesInList.forEach(catKey => {
        const catInfo = categoryLabels[catKey] || { title: catKey.toUpperCase(), color: '#64748B' };
        const toolsInCat = filtered.filter(t => t.cat === catKey);

        html += `
            <div class="glass-card" style="padding: 14px;">
                <h4 style="margin: 0 0 12px 0; font-size: 0.92rem; color: ${catInfo.color}; font-weight: 700;">${catInfo.title}</h4>
                <div class="tool-grid">
                    ${toolsInCat.map(tool => `
                        <a href="${tool.url}" class="tool-card">
                            <div class="tool-card-header">
                                <div class="tool-card-icon" style="background: ${tool.color}18; color: ${tool.color};">
                                    <i class="fa-solid ${tool.icon}"></i>
                                </div>
                                <div class="tool-card-title">${tool.title}</div>
                            </div>
                            <div class="tool-card-desc">${tool.desc}</div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
