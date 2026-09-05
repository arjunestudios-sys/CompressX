/**
 * Docholder All Tools Directory JavaScript
 */

const TOOLS_DIRECTORY = [
    // Documents
    { id: 'doc-compress', title: 'PDF Compress', desc: 'Reduce PDF file size with optimal quality', cat: 'doc', icon: 'fa-file-pdf', color: '#EF4444', url: 'document-tools.html?tool=compress' },
    { id: 'doc-merge', title: 'PDF Merge', desc: 'Combine multiple PDF files into one', cat: 'doc', icon: 'fa-object-group', color: '#EF4444', url: 'document-tools.html?tool=merge' },
    { id: 'doc-split', title: 'PDF Split', desc: 'Split pages into individual documents', cat: 'doc', icon: 'fa-scissors', color: '#EF4444', url: 'document-tools.html?tool=split' },
    { id: 'doc-extract', title: 'Extract Pages', desc: 'Select and export specific PDF pages', cat: 'doc', icon: 'fa-file-export', color: '#EF4444', url: 'document-tools.html?tool=extract' },
    { id: 'doc-remove', title: 'Remove Pages', desc: 'Delete unwanted pages from PDF', cat: 'doc', icon: 'fa-trash-can', color: '#EF4444', url: 'document-tools.html?tool=remove' },
    { id: 'doc-rotate', title: 'PDF Rotate', desc: 'Rotate pages 90°, 180° or 270°', cat: 'doc', icon: 'fa-rotate', color: '#EF4444', url: 'document-tools.html?tool=rotate' },
    { id: 'doc-watermark', title: 'PDF Watermark', desc: 'Add text stamp or security watermark', cat: 'doc', icon: 'fa-stamp', color: '#EF4444', url: 'document-tools.html?tool=watermark' },
    { id: 'doc-pagenum', title: 'Page Numbers', desc: 'Add clean header/footer page numbering', cat: 'doc', icon: 'fa-list-ol', color: '#EF4444', url: 'document-tools.html?tool=pagenum' },
    { id: 'doc-protect', title: 'PDF Protect', desc: 'Lock and encrypt PDF with password', cat: 'doc', icon: 'fa-lock', color: '#EF4444', url: 'document-tools.html?tool=protect' },
    { id: 'doc-redact', title: 'PDF Redact', desc: 'Black out sensitive text or regions', cat: 'doc', icon: 'fa-eraser', color: '#EF4444', url: 'document-tools.html?tool=redact' },
    { id: 'doc-sign', title: 'PDF Sign', desc: 'Add digital signature stamp to PDF', cat: 'doc', icon: 'fa-signature', color: '#EF4444', url: 'document-tools.html?tool=sign' },
    { id: 'doc-pdfa', title: 'PDF → PDF/A', desc: 'Convert to ISO archival conformance', cat: 'doc', icon: 'fa-file-shield', color: '#DC2626', url: 'document-tools.html?tool=pdfa' },
    { id: 'doc-editor', title: 'PDF Annotation', desc: 'Draw, highlight, and annotate live', cat: 'doc', icon: 'fa-pen-to-square', color: '#EF4444', url: 'pdf-editor.html' },
    { id: 'doc-convert', title: 'PDF Convert', desc: 'Convert PDF to Word, PPTX, Images, Text', cat: 'doc', icon: 'fa-rotate', color: '#EF4444', url: 'document-tools.html?tool=convert' },

    // Word Tools
    { id: 'word-studio', title: 'Word Studio', desc: 'Edit text, format typography & convert Word docs', cat: 'word', icon: 'fa-file-word', color: '#3B82F6', url: 'word-tools.html' },
    { id: 'word-to-pdf', title: 'Word → PDF', desc: 'Convert DOCX document to high-quality PDF', cat: 'word', icon: 'fa-file-pdf', color: '#3B82F6', url: 'word-tools.html?mode=convert' },
    { id: 'word-to-pptx', title: 'Word → PowerPoint', desc: 'Convert Word headings into presentation slides', cat: 'word', icon: 'fa-file-powerpoint', color: '#3B82F6', url: 'word-tools.html?mode=convert' },
    { id: 'word-to-txt', title: 'Word → Text', desc: 'Extract raw text and copy paragraphs', cat: 'word', icon: 'fa-file-lines', color: '#3B82F6', url: 'word-tools.html?mode=convert' },

    // Images
    { id: 'img-compress', title: 'Compress Image', desc: 'Optimize JPG, PNG, WebP with Target Size', cat: 'image', icon: 'fa-compress', color: '#8B5CF6', url: 'image-tools.html?tool=compress' },
    { id: 'img-resize', title: 'Resize Image', desc: 'Change dimensions, 4K, 1080p, 720p or %', cat: 'image', icon: 'fa-up-right-and-down-left-from-center', color: '#8B5CF6', url: 'image-tools.html?tool=resize' },
    { id: 'img-convert', title: 'Convert Image', desc: 'Convert between JPG, PNG, WEBP, TIFF, BMP', cat: 'image', icon: 'fa-rotate', color: '#8B5CF6', url: 'image-tools.html?tool=convert' },
    { id: 'img-crop', title: 'Crop Image', desc: 'Crop rectangular sections from image', cat: 'image', icon: 'fa-crop', color: '#8B5CF6', url: 'image-tools.html?tool=crop' },
    { id: 'img-rotate', title: 'Rotate & Flip', desc: 'Rotate 90°/180° or mirror flip image', cat: 'image', icon: 'fa-arrows-rotate', color: '#8B5CF6', url: 'image-tools.html?tool=rotate' },
    { id: 'img-exif', title: 'Strip EXIF', desc: 'Remove camera/location metadata for privacy', cat: 'image', icon: 'fa-shield-halved', color: '#8B5CF6', url: 'image-tools.html?tool=exif' },
    { id: 'img-to-pdf', title: 'Images → PDF', desc: 'Combine multiple images into one PDF', cat: 'image', icon: 'fa-file-pdf', color: '#8B5CF6', url: 'image-tools.html?tool=multi-pdf' },

    // Videos
    { id: 'vid-compress', title: 'Compress Video', desc: 'Reduce video size with target size / CRF', cat: 'video', icon: 'fa-file-video', color: '#EC4899', url: 'video-tools.html?tool=compress' },
    { id: 'vid-convert', title: 'Convert Video', desc: 'MP4, WEBM, MOV, AVI, MKV, GIF', cat: 'video', icon: 'fa-rotate', color: '#EC4899', url: 'video-tools.html?tool=convert' },
    { id: 'vid-extract', title: 'Extract Audio', desc: 'Extract MP3, WAV or AAC from video', cat: 'video', icon: 'fa-music', color: '#EC4899', url: 'video-tools.html?tool=extract' },
    { id: 'vid-resize', title: 'Resize Video', desc: 'Scale video to 1080p, 720p or 480p', cat: 'video', icon: 'fa-expand', color: '#EC4899', url: 'video-tools.html?tool=resize' },
    { id: 'vid-trim', title: 'Trim Video', desc: 'Cut video timestamps and durations', cat: 'video', icon: 'fa-scissors', color: '#EC4899', url: 'video-tools.html?tool=trim' },
    { id: 'vid-gif', title: 'Video → GIF', desc: 'Create animated GIF from video clip', cat: 'video', icon: 'fa-film', color: '#EC4899', url: 'video-tools.html?tool=gif' },

    // Audio
    { id: 'aud-convert', title: 'Convert Audio', desc: 'MP3, WAV, AAC, OGG, M4A, FLAC', cat: 'audio', icon: 'fa-file-audio', color: '#10B981', url: 'audio-tools.html?tool=convert' },
    { id: 'aud-compress', title: 'Compress Audio', desc: 'Reduce bitrate (64k, 128k, 192k, 320k)', cat: 'audio', icon: 'fa-compress', color: '#10B981', url: 'audio-tools.html?tool=compress' },
    { id: 'aud-trim', title: 'Trim Audio', desc: 'Cut sound clip start and end timestamps', cat: 'audio', icon: 'fa-scissors', color: '#10B981', url: 'audio-tools.html?tool=trim' },
    { id: 'aud-transcribe', title: 'Audio → Text', desc: 'Transcribe speech with TXT, DOCX, and PDF export', cat: 'audio', icon: 'fa-file-lines', color: '#10B981', url: 'audio-tools.html?tool=transcribe' },

    // Convert & Multi-Format
    { id: 'conv-multi', title: 'Export to Multiple Formats', desc: 'Export 1 file to 4+ formats simultaneously', cat: 'convert', icon: 'fa-layer-group', color: '#06B6D4', url: 'convert.html?mode=multi' },
    { id: 'conv-batch', title: 'Batch Converter', desc: 'Convert multiple files at once + ZIP download', cat: 'convert', icon: 'fa-arrows-split-up-and-left', color: '#06B6D4', url: 'convert.html?mode=batch' },
    { id: 'conv-universal', title: 'Universal Convert', desc: 'Convert any file into any supported format', cat: 'convert', icon: 'fa-rotate', color: '#06B6D4', url: 'convert.html' },

    // Compress & Optimize
    { id: 'comp-smart', title: 'Smart Make It Smaller', desc: 'One-click optimal size reduction for all files', cat: 'compress', icon: 'fa-bolt', color: '#F59E0B', url: 'compress.html' },
    { id: 'comp-target', title: 'Target Size Mode', desc: 'Force file below specified KB or MB', cat: 'compress', icon: 'fa-crosshairs', color: '#F59E0B', url: 'convert.html?mode=target' },

    // Archive
    { id: 'arch-zip', title: 'Create ZIP Archive', desc: 'Compress multiple files into secure ZIP', cat: 'archive', icon: 'fa-file-zipper', color: '#EAB308', url: 'compress.html?format=zip' },
    { id: 'arch-extract', title: 'Extract Archive', desc: 'Extract ZIP, TAR, GZ archives', cat: 'archive', icon: 'fa-box-open', color: '#EAB308', url: 'extract.html' }
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
            history.replaceState(null, '', newUrl);
            renderToolsDirectory(cat, document.getElementById('tool-search-input').value);
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
                <h4 style="margin: 0 0 10px 0; font-size: 0.88rem; color: ${catInfo.color};">${catInfo.title}</h4>
                <div class="tool-grid">
                    ${toolsInCat.map(tool => `
                        <a href="${tool.url}" class="tool-card">
                            <div class="tool-card-icon" style="background: ${tool.color}18; color: ${tool.color};">
                                <i class="fa-solid ${tool.icon}"></i>
                            </div>
                            <div class="tool-card-title">${tool.title}</div>
                            <div class="tool-card-desc">${tool.desc}</div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
