/**
 * Docholder Universal Frontend Format Registry & Operations Catalog
 */

const ClientFormatRegistry = {
    categories: {
        DOCUMENT: { id: 'doc', label: 'Documents', icon: 'fa-file-lines', color: '#EF4444' },
        IMAGE: { id: 'image', label: 'Images', icon: 'fa-image', color: '#8B5CF6' },
        VIDEO: { id: 'video', label: 'Videos', icon: 'fa-video', color: '#EC4899' },
        AUDIO: { id: 'audio', label: 'Audio', icon: 'fa-music', color: '#10B981' },
        SPREADSHEET: { id: 'spreadsheet', label: 'Spreadsheets', icon: 'fa-table', color: '#059669' },
        PRESENTATION: { id: 'presentation', label: 'Presentations', icon: 'fa-chalkboard', color: '#F97316' },
        TEXT_DATA: { id: 'text_data', label: 'Text & Data', icon: 'fa-code', color: '#0EA5E9' },
        ARCHIVE: { id: 'archive', label: 'Archives', icon: 'fa-file-zipper', color: '#F59E0B' }
    },

    formats: {
        pdf: { ext: 'pdf', label: 'PDF Document', category: 'DOCUMENT', icon: 'fa-file-pdf', color: '#EF4444' },
        docx: { ext: 'docx', label: 'Word Document (.docx)', category: 'DOCUMENT', icon: 'fa-file-word', color: '#3B82F6' },
        doc: { ext: 'doc', label: 'Legacy Word (.doc)', category: 'DOCUMENT', icon: 'fa-file-word', color: '#3B82F6' },
        pdfa: { ext: 'pdf', label: 'PDF/A (Archival)', category: 'DOCUMENT', icon: 'fa-file-shield', color: '#DC2626' },
        xlsx: { ext: 'xlsx', label: 'Excel Spreadsheet (.xlsx)', category: 'SPREADSHEET', icon: 'fa-file-excel', color: '#10B981' },
        xls: { ext: 'xls', label: 'Excel 97-2003 (.xls)', category: 'SPREADSHEET', icon: 'fa-file-excel', color: '#10B981' },
        csv: { ext: 'csv', label: 'CSV Table (.csv)', category: 'SPREADSHEET', icon: 'fa-file-csv', color: '#059669' },
        pptx: { ext: 'pptx', label: 'PowerPoint (.pptx)', category: 'PRESENTATION', icon: 'fa-file-powerpoint', color: '#F97316' },
        ppt: { ext: 'ppt', label: 'PowerPoint 97-2003 (.ppt)', category: 'PRESENTATION', icon: 'fa-file-powerpoint', color: '#F97316' },
        jpg: { ext: 'jpg', label: 'JPG Image (.jpg)', category: 'IMAGE', icon: 'fa-file-image', color: '#8B5CF6' },
        jpeg: { ext: 'jpg', label: 'JPEG Image (.jpg)', category: 'IMAGE', icon: 'fa-file-image', color: '#8B5CF6' },
        png: { ext: 'png', label: 'PNG Image (.png)', category: 'IMAGE', icon: 'fa-file-image', color: '#6366F1' },
        webp: { ext: 'webp', label: 'WebP Image (.webp)', category: 'IMAGE', icon: 'fa-file-image', color: '#06B6D4' },
        tiff: { ext: 'tiff', label: 'TIFF Image (.tiff)', category: 'IMAGE', icon: 'fa-file-image', color: '#EC4899' },
        bmp: { ext: 'bmp', label: 'BMP Image (.bmp)', category: 'IMAGE', icon: 'fa-file-image', color: '#F59E0B' },
        gif: { ext: 'gif', label: 'GIF Animation (.gif)', category: 'IMAGE', icon: 'fa-file-image', color: '#14B8A6' },
        mp4: { ext: 'mp4', label: 'MP4 Video (.mp4)', category: 'VIDEO', icon: 'fa-file-video', color: '#EC4899' },
        webm: { ext: 'webm', label: 'WebM Video (.webm)', category: 'VIDEO', icon: 'fa-file-video', color: '#8B5CF6' },
        mov: { ext: 'mov', label: 'QuickTime Video (.mov)', category: 'VIDEO', icon: 'fa-file-video', color: '#3B82F6' },
        avi: { ext: 'avi', label: 'AVI Video (.avi)', category: 'VIDEO', icon: 'fa-file-video', color: '#6366F1' },
        mkv: { ext: 'mkv', label: 'MKV Video (.mkv)', category: 'VIDEO', icon: 'fa-file-video', color: '#6D28D9' },
        mp3: { ext: 'mp3', label: 'MP3 Audio (.mp3)', category: 'AUDIO', icon: 'fa-file-audio', color: '#10B981' },
        wav: { ext: 'wav', label: 'WAV Audio (.wav)', category: 'AUDIO', icon: 'fa-file-audio', color: '#06B6D4' },
        aac: { ext: 'aac', label: 'AAC Audio (.aac)', category: 'AUDIO', icon: 'fa-file-audio', color: '#3B82F6' },
        ogg: { ext: 'ogg', label: 'OGG Audio (.ogg)', category: 'AUDIO', icon: 'fa-file-audio', color: '#F59E0B' },
        m4a: { ext: 'm4a', label: 'M4A Audio (.m4a)', category: 'AUDIO', icon: 'fa-file-audio', color: '#6366F1' },
        flac: { ext: 'flac', label: 'FLAC Audio (.flac)', category: 'AUDIO', icon: 'fa-file-audio', color: '#14B8A6' },
        txt: { ext: 'txt', label: 'Plain Text (.txt)', category: 'TEXT_DATA', icon: 'fa-file-lines', color: '#64748B' },
        html: { ext: 'html', label: 'HTML Webpage (.html)', category: 'TEXT_DATA', icon: 'fa-code', color: '#F97316' },
        md: { ext: 'md', label: 'Markdown (.md)', category: 'TEXT_DATA', icon: 'fa-hashtag', color: '#0EA5E9' },
        json: { ext: 'json', label: 'JSON Data (.json)', category: 'TEXT_DATA', icon: 'fa-code-branch', color: '#FBBF24' },
        zip: { ext: 'zip', label: 'ZIP Archive (.zip)', category: 'ARCHIVE', icon: 'fa-file-zipper', color: '#F59E0B' }
    },

    conversionMatrix: {
        pdf: ['docx', 'xlsx', 'txt', 'html', 'md', 'jpg', 'png', 'pdfa'],
        docx: ['pdf', 'txt', 'html', 'md'],
        doc: ['pdf', 'txt', 'html'],
        xlsx: ['pdf', 'csv', 'txt', 'html', 'json'],
        xls: ['pdf', 'csv', 'txt', 'html', 'json'],
        csv: ['xlsx', 'pdf', 'txt', 'html', 'json'],
        pptx: ['pdf', 'jpg', 'png', 'txt'],
        ppt: ['pdf', 'jpg', 'png', 'txt'],
        jpg: ['png', 'webp', 'pdf', 'tiff', 'bmp'],
        jpeg: ['png', 'webp', 'pdf', 'tiff', 'bmp'],
        png: ['jpg', 'webp', 'pdf', 'tiff', 'bmp'],
        webp: ['jpg', 'png', 'pdf', 'tiff', 'bmp'],
        tiff: ['jpg', 'png', 'webp', 'pdf'],
        bmp: ['jpg', 'png', 'webp', 'pdf'],
        gif: ['jpg', 'png', 'webp', 'mp4'],
        mp4: ['webm', 'mov', 'avi', 'gif', 'mp3', 'wav', 'aac'],
        webm: ['mp4', 'mov', 'gif', 'mp3', 'wav'],
        mov: ['mp4', 'webm', 'gif', 'mp3', 'wav'],
        avi: ['mp4', 'webm', 'gif', 'mp3', 'wav'],
        mkv: ['mp4', 'webm', 'gif', 'mp3', 'wav'],
        mp3: ['wav', 'aac', 'ogg', 'm4a', 'flac'],
        wav: ['mp3', 'aac', 'ogg', 'm4a', 'flac'],
        aac: ['mp3', 'wav', 'ogg'],
        ogg: ['mp3', 'wav', 'aac'],
        m4a: ['mp3', 'wav', 'aac'],
        flac: ['mp3', 'wav', 'aac', 'ogg'],
        txt: ['pdf', 'docx', 'html', 'md'],
        md: ['pdf', 'html', 'docx', 'txt'],
        html: ['pdf', 'txt', 'md'],
        json: ['txt', 'csv', 'xlsx', 'html']
    },

    recommendations: {
        docx: ['pdf', 'txt', 'html'],
        doc: ['pdf', 'txt'],
        pdf: ['docx', 'txt', 'pdfa'],
        xlsx: ['csv', 'pdf', 'json'],
        csv: ['xlsx', 'json', 'pdf'],
        pptx: ['pdf', 'jpg'],
        jpg: ['webp', 'png', 'pdf'],
        png: ['webp', 'jpg', 'pdf'],
        webp: ['jpg', 'png', 'pdf'],
        mp4: ['mp3', 'webm', 'gif'],
        mov: ['mp4', 'mp3'],
        mp3: ['wav', 'aac'],
        wav: ['mp3', 'flac'],
        txt: ['pdf', 'docx']
    },

    getTargetFormats(sourceExt) {
        const ext = (sourceExt || '').toLowerCase().replace(/^\./, '');
        const targetKeys = this.conversionMatrix[ext] || [];
        return targetKeys.map(k => this.formats[k] || { ext: k, label: k.toUpperCase(), icon: 'fa-file', color: '#64748B' });
    },

    getRecommendedFormats(sourceExt) {
        const ext = (sourceExt || '').toLowerCase().replace(/^\./, '');
        const recKeys = this.recommendations[ext] || (this.conversionMatrix[ext] || []).slice(0, 3);
        return recKeys.map(k => this.formats[k] || { ext: k, label: k.toUpperCase(), icon: 'fa-file', color: '#64748B' });
    },

    isConversionSupported(sourceExt, targetExt) {
        const s = (sourceExt || '').toLowerCase().replace(/^\./, '');
        const t = (targetExt || '').toLowerCase().replace(/^\./, '');
        const targets = this.conversionMatrix[s] || [];
        return targets.includes(t);
    }
};

/**
 * Centralized Operation Catalog & Registry (Section 23)
 */
const DocholderOperationRegistry = {
    operations: [
        // PDF Operations
        {
            id: 'pdf-compress',
            name: 'Compress PDF',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Reduce PDF file size while keeping the document readable.',
            icon: 'fa-compress',
            workspace: 'document-tools.html?tool=compress',
            backendHandler: '/api/pdf/compress',
            capabilities: ['compression', 'lossless', 'optimization']
        },
        {
            id: 'pdf-protect',
            name: 'Protect PDF',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Lock your PDF with a password and set printing or copy permissions.',
            icon: 'fa-lock',
            workspace: 'document-tools.html?tool=protect',
            backendHandler: '/api/pdf/protect',
            capabilities: ['password', 'permissions', 'encryption']
        },
        {
            id: 'pdf-sign',
            name: 'Sign PDF',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Draw, type, or upload a signature and place it anywhere on your PDF.',
            icon: 'fa-signature',
            workspace: 'document-tools.html?tool=sign',
            backendHandler: '/api/pdf/sign',
            capabilities: ['draw', 'type', 'upload', 'placement']
        },
        {
            id: 'pdf-annotate',
            name: 'Annotate PDF',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Add highlights, notes, stamps, and shapes to your document.',
            icon: 'fa-highlighter',
            workspace: 'document-tools.html?tool=annotate',
            backendHandler: '/api/pdf/annotate',
            capabilities: ['highlight', 'text_note', 'shapes', 'color_selection']
        },
        {
            id: 'pdf-redact',
            name: 'Redact PDF',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Permanently blackout sensitive personal, financial, or private data.',
            icon: 'fa-eraser',
            workspace: 'document-tools.html?tool=redact',
            backendHandler: '/api/pdf/redact',
            capabilities: ['permanent_wipe', 'blackout_box', 'presets']
        },
        {
            id: 'pdf-merge',
            name: 'Merge PDFs',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Combine multiple PDF files into one single document.',
            icon: 'fa-object-group',
            workspace: 'document-tools.html?tool=merge',
            backendHandler: '/api/pdf/merge'
        },
        {
            id: 'pdf-split',
            name: 'Split PDF',
            category: 'doc',
            supportedInputFormats: ['pdf'],
            supportedOutputFormats: ['pdf'],
            description: 'Separate PDF pages into individual files or custom page ranges.',
            icon: 'fa-scissors',
            workspace: 'document-tools.html?tool=split',
            backendHandler: '/api/pdf/split'
        },
        {
            id: 'docx-edit',
            name: 'Edit Word Document',
            category: 'doc',
            supportedInputFormats: ['docx', 'doc'],
            supportedOutputFormats: ['docx', 'pdf', 'txt'],
            description: 'Edit Word text, change formatting, and export to PDF.',
            icon: 'fa-file-word',
            workspace: 'docx-editor.html',
            backendHandler: '/api/docx',
            capabilities: ['find_replace', 'format', 'export_pdf', 'export_txt']
        },

        // Image Operations
        {
            id: 'image-resize',
            name: 'Resize Image',
            category: 'image',
            supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif'],
            supportedOutputFormats: ['jpg', 'png', 'webp'],
            description: 'Change pixel dimensions or percentage scaling with aspect ratio lock.',
            icon: 'fa-up-right-and-down-left-from-center',
            workspace: 'image-tools.html?tool=resize',
            backendHandler: '/api/image/resize',
            capabilities: ['presets', 'pixels', 'percentage', 'aspect_ratio']
        },
        {
            id: 'image-crop',
            name: 'Crop Image',
            category: 'image',
            supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'],
            supportedOutputFormats: ['jpg', 'png', 'webp'],
            description: 'Interactive crop rectangle with standard aspect ratio presets (1:1, 4:3, 16:9).',
            icon: 'fa-crop',
            workspace: 'image-tools.html?tool=crop',
            backendHandler: '/api/image/crop',
            capabilities: ['crop_box', 'ratio_presets', 'reset']
        },
        {
            id: 'image-rotate-flip',
            name: 'Rotate & Flip Image',
            category: 'image',
            supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif'],
            supportedOutputFormats: ['jpg', 'png', 'webp'],
            description: 'Rotate left/right, flip horizontally or vertically, and apply custom rotation angles.',
            icon: 'fa-rotate',
            workspace: 'image-tools.html?tool=crop',
            backendHandler: '/api/image/transform',
            capabilities: ['rotate_90', 'rotate_custom', 'flip_h', 'flip_v']
        },
        {
            id: 'image-convert',
            name: 'Convert Image',
            category: 'image',
            supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif'],
            supportedOutputFormats: ['jpg', 'png', 'webp', 'pdf', 'tiff', 'bmp'],
            description: 'Convert between all major image formats with high visual fidelity.',
            icon: 'fa-rotate',
            workspace: 'image-tools.html?tool=convert',
            backendHandler: '/api/image/convert'
        },

        // Video Operations
        {
            id: 'video-compress',
            name: 'Compress Video',
            category: 'video',
            supportedInputFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
            supportedOutputFormats: ['mp4'],
            description: 'Reduce video file size with intelligent CRF presets and resolution downscaling.',
            icon: 'fa-compress',
            workspace: 'video-tools.html?tool=compress',
            backendHandler: '/api/media/compress-video',
            capabilities: ['quality_preset', 'resolution', 'target_size', 'strip_audio']
        },
        {
            id: 'video-extract-audio',
            name: 'Extract Audio',
            category: 'video',
            supportedInputFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
            supportedOutputFormats: ['mp3', 'wav', 'aac', 'ogg'],
            description: 'Extract crystal-clear audio soundtrack from video in MP3, WAV, or AAC format.',
            icon: 'fa-music',
            workspace: 'video-tools.html?tool=extract',
            backendHandler: '/api/media/extract-audio',
            capabilities: ['mp3', 'wav', 'aac', 'bitrate_selection']
        },
        {
            id: 'video-convert',
            name: 'Convert Video',
            category: 'video',
            supportedInputFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
            supportedOutputFormats: ['mp4', 'webm', 'mov', 'avi', 'gif'],
            description: 'Transcode between MP4, WebM, MOV, AVI, and animated GIF.',
            icon: 'fa-film',
            workspace: 'video-tools.html?tool=convert',
            backendHandler: '/api/media/convert-video'
        },

        // Feature 1: AI Content Rate Tracker
        {
            id: 'ai-content-tracker',
            name: 'AI Content Rate Tracker',
            category: 'ai',
            supportedInputFormats: ['txt', 'docx', 'doc', 'pdf', 'md'],
            supportedOutputFormats: ['json'],
            description: 'Probabilistic AI-likeness assessment & structural signal analysis.',
            icon: 'fa-brain',
            workspace: 'document-tools.html?tool=ai-detector',
            backendHandler: '/api/files/ai-detector',
            capabilities: ['ai_detection', 'signal_analysis']
        },
        // Feature 2: Smart Humanizer
        {
            id: 'ai-humanizer',
            name: 'Smart Humanizer',
            category: 'ai',
            supportedInputFormats: ['txt', 'docx', 'doc', 'pdf', 'md'],
            supportedOutputFormats: ['txt', 'docx'],
            description: 'Controlled AI humanization with character limits and before/after comparison.',
            icon: 'fa-user-pen',
            workspace: 'document-tools.html?tool=humanize',
            backendHandler: '/api/files/humanize',
            capabilities: ['character_limit', 'mode_selection', 'diff_view']
        },
        // Feature 3: AI Document Understanding
        {
            id: 'doc-understanding',
            name: 'Document Understanding',
            category: 'ai',
            supportedInputFormats: ['pdf', 'docx', 'txt', 'xlsx'],
            supportedOutputFormats: ['json'],
            description: 'Extract summary, key findings, dates, action items, and entities.',
            icon: 'fa-file-circle-check',
            workspace: 'document-tools.html?tool=understand',
            backendHandler: '/api/files/understand',
            capabilities: ['summary', 'entities', 'action_items']
        },
        // Feature 4: Chat With Any File
        {
            id: 'doc-chat',
            name: 'Chat With Any File',
            category: 'ai',
            supportedInputFormats: ['pdf', 'docx', 'txt', 'pptx', 'xlsx', 'jpg', 'png', 'mp3', 'mp4'],
            supportedOutputFormats: ['json'],
            description: 'Universal document Q&A with page and section citations.',
            icon: 'fa-comments',
            workspace: 'document-tools.html?tool=chat',
            backendHandler: '/api/files/chat',
            capabilities: ['citations', 'qa']
        },
        // Feature 5: Cross-File Intelligence
        {
            id: 'cross-file-intelligence',
            name: 'Cross-File Intelligence',
            category: 'ai',
            supportedInputFormats: ['pdf', 'docx', 'xlsx', 'pptx', 'txt'],
            supportedOutputFormats: ['json'],
            description: 'Compare facts, revenue data, and discrepancies across multiple uploaded files.',
            icon: 'fa-network-wired',
            workspace: 'document-tools.html?tool=cross-intelligence',
            backendHandler: '/api/files/cross-intelligence',
            capabilities: ['multi_file_compare', 'synthesis']
        },
        // Feature 6: Document Fact Checker
        {
            id: 'doc-fact-checker',
            name: 'Document Fact Checker',
            category: 'ai',
            supportedInputFormats: ['pdf', 'docx', 'txt'],
            supportedOutputFormats: ['json'],
            description: 'Extract and classify factual claims (Supported, Requires Verification, Unverified).',
            icon: 'fa-check-double',
            workspace: 'document-tools.html?tool=fact-check',
            backendHandler: '/api/files/fact-check',
            capabilities: ['claim_extraction', 'verification']
        },
        // Feature 7: Document Version Diff
        {
            id: 'doc-version-diff',
            name: 'Document Version Diff',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'txt'],
            supportedOutputFormats: ['json'],
            description: 'Page-by-page comparison showing additions, removals, and modifications.',
            icon: 'fa-code-compare',
            workspace: 'document-tools.html?tool=diff',
            backendHandler: '/api/files/diff',
            capabilities: ['visual_diff', 'text_diff']
        },
        // Feature 8: Document DNA
        {
            id: 'doc-dna',
            name: 'Document DNA',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'png'],
            supportedOutputFormats: ['json'],
            description: 'Deep metadata fingerprint, image/table count, OCR status, and stable hash.',
            icon: 'fa-fingerprint',
            workspace: 'document-tools.html?tool=dna',
            backendHandler: '/api/files/dna',
            capabilities: ['hash', 'metadata_profile']
        },
        // Feature 9: Document Health Score
        {
            id: 'doc-health-score',
            name: 'Document Health Score',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'jpg', 'png'],
            supportedOutputFormats: ['json'],
            description: 'Calculate 0-100 quality score checking size, OCR, structure, and images.',
            icon: 'fa-notes-medical',
            workspace: 'document-tools.html?tool=health',
            backendHandler: '/api/files/health',
            capabilities: ['health_checks', 'scoring']
        },
        // Feature 10: One-Click Fix My File
        {
            id: 'fix-my-file',
            name: 'Fix My File',
            category: 'doc',
            supportedInputFormats: ['pdf', 'jpg', 'png', 'docx'],
            supportedOutputFormats: ['pdf'],
            description: 'Automated repair, optimization, OCR, metadata clean, and structure fix pipeline.',
            icon: 'fa-wand-magic-sparkles',
            workspace: 'document-tools.html?tool=fix-everything',
            backendHandler: '/api/files/fix-everything',
            capabilities: ['pipeline_repair', 'one_click_fix']
        },
        // Feature 11: Goal-Based File Optimization
        {
            id: 'goal-optimization',
            name: 'Goal-Based File Optimization',
            category: 'doc',
            supportedInputFormats: ['pdf', 'jpg', 'png', 'webp', 'docx'],
            supportedOutputFormats: ['pdf', 'webp', 'jpg', 'zip'],
            description: 'Preset optimization for Email, Website, Mobile, Printing, Archive, Submission.',
            icon: 'fa-bullseye',
            workspace: 'document-tools.html?tool=goal-optimize',
            backendHandler: '/api/files/goal-optimize',
            capabilities: ['goal_presets', 'auto_compression']
        },
        // Feature 12: Smart File Packaging
        {
            id: 'smart-packaging',
            name: 'Smart File Packaging',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'xlsx', 'jpg', 'png'],
            supportedOutputFormats: ['zip'],
            description: 'Validate, convert, compress, standardize naming, strip metadata, and package ZIP.',
            icon: 'fa-box-archive',
            workspace: 'document-tools.html?tool=smart-package',
            backendHandler: '/api/files/smart-package',
            capabilities: ['submission_manifest', 'batch_zip']
        },
        // Feature 13: AI Automatic File Naming
        {
            id: 'ai-file-naming',
            name: 'AI Automatic File Naming',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'txt', 'csv'],
            supportedOutputFormats: ['json'],
            description: 'Analyze file contents and recommend standardized, meaningful filenames.',
            icon: 'fa-tag',
            workspace: 'document-tools.html?tool=suggest-name',
            backendHandler: '/api/files/suggest-name',
            capabilities: ['naming_recommendation']
        },
        // Feature 14 & 15: Document Classification & Auto-Tagging
        {
            id: 'doc-classification',
            name: 'Automatic Classification & Tagging',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'txt', 'csv'],
            supportedOutputFormats: ['json'],
            description: 'Auto classify into Invoices, Contracts, Reports, Financials, and generate tags.',
            icon: 'fa-tags',
            workspace: 'document-tools.html?tool=classify',
            backendHandler: '/api/files/classify',
            capabilities: ['category_detect', 'tag_generation']
        },
        // Feature 16: Privacy Risk Scanner
        {
            id: 'privacy-scanner',
            name: 'Privacy Risk Scanner',
            category: 'security',
            supportedInputFormats: ['pdf', 'docx', 'txt'],
            supportedOutputFormats: ['json'],
            description: 'Detect sensitive PII (Names, Emails, Phone numbers, Account numbers, SSNs).',
            icon: 'fa-shield-cat',
            workspace: 'document-tools.html?tool=privacy-scan',
            backendHandler: '/api/files/privacy-scan',
            capabilities: ['pii_detection', 'risk_scoring']
        },
        // Feature 17: Smart PII Redaction
        {
            id: 'pii-redaction',
            name: 'Smart PII Redaction',
            category: 'security',
            supportedInputFormats: ['pdf', 'docx', 'txt'],
            supportedOutputFormats: ['pdf', 'txt'],
            description: 'Wipe underlying sensitive text and apply blackout overlays.',
            icon: 'fa-user-shield',
            workspace: 'document-tools.html?tool=redact-pii',
            backendHandler: '/api/files/redact-pii',
            capabilities: ['text_wiping', 'blackout_box']
        },
        // Feature 18: Universal Translation Workspace
        {
            id: 'universal-translation',
            name: 'Universal Translation',
            category: 'doc',
            supportedInputFormats: ['pdf', 'docx', 'txt', 'jpg', 'png'],
            supportedOutputFormats: ['pdf', 'docx', 'txt'],
            description: 'Translate documents to Tamil, Hindi, English, French, Spanish, German, Japanese, Chinese.',
            icon: 'fa-language',
            workspace: 'document-tools.html?tool=translate',
            backendHandler: '/api/files/translate',
            capabilities: ['layout_preservation', 'multi_language']
        },
        // Feature 19: Meeting Intelligence
        {
            id: 'meeting-intelligence',
            name: 'Meeting / Audio Intelligence',
            category: 'audio',
            supportedInputFormats: ['mp3', 'wav', 'm4a', 'aac', 'flac'],
            supportedOutputFormats: ['txt', 'docx', 'pdf'],
            description: 'Generate transcript, summary, key decisions, action items, and participant lists.',
            icon: 'fa-users-gear',
            workspace: 'audio-tools.html?tool=meeting-intelligence',
            backendHandler: '/api/media/meeting-intelligence',
            capabilities: ['transcript', 'summary', 'action_items']
        },
        // Feature 20: Video Intelligence
        {
            id: 'video-intelligence',
            name: 'Video Intelligence',
            category: 'video',
            supportedInputFormats: ['mp4', 'webm', 'mov', 'avi'],
            supportedOutputFormats: ['json'],
            description: 'Extract transcript, summary, timestamped chapters, and key moments.',
            icon: 'fa-film',
            workspace: 'video-tools.html?tool=video-intelligence',
            backendHandler: '/api/media/video-intelligence',
            capabilities: ['chapters', 'key_moments']
        },
        // Feature 21: Automatic Subtitle Generator
        {
            id: 'subtitle-generator',
            name: 'Automatic Subtitle Generator',
            category: 'video',
            supportedInputFormats: ['mp4', 'webm', 'mov', 'mp3', 'wav'],
            supportedOutputFormats: ['srt', 'vtt'],
            description: 'Speech recognition timestamped subtitle generator with inline editing & export.',
            icon: 'fa-closed-captioning',
            workspace: 'video-tools.html?tool=subtitles',
            backendHandler: '/api/media/subtitles',
            capabilities: ['srt_vtt_export', 'timestamp_editor']
        },
        // Feature 22: Image Intelligence
        {
            id: 'image-intelligence',
            name: 'Image Intelligence',
            category: 'image',
            supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'],
            supportedOutputFormats: ['json', 'pdf', 'txt'],
            description: 'OCR text extraction, object detection, QR/barcode scanning, and table detection.',
            icon: 'fa-eye',
            workspace: 'image-tools.html?tool=image-intelligence',
            backendHandler: '/api/image/analyze',
            capabilities: ['ocr', 'object_detection', 'qr_scanner']
        },
        // Feature 23: Smart Document Scanner
        {
            id: 'smart-document-scanner',
            name: 'Smart Document Scanner',
            category: 'image',
            supportedInputFormats: ['jpg', 'jpeg', 'png', 'webp'],
            supportedOutputFormats: ['pdf'],
            description: 'Boundary detection, perspective correction, background cleanup, shadow reduction, OCR.',
            icon: 'fa-camera-rotate',
            workspace: 'image-tools.html?tool=document-scan',
            backendHandler: '/api/image/document-scan',
            capabilities: ['perspective_correction', 'searchable_pdf']
        },
        // Feature 24: Spreadsheet Intelligence
        {
            id: 'spreadsheet-intelligence',
            name: 'Spreadsheet Intelligence',
            category: 'spreadsheet',
            supportedInputFormats: ['xlsx', 'xls', 'csv'],
            supportedOutputFormats: ['json'],
            description: 'Tabular Q&A, highest revenue detection, anomaly analysis, and statistical summary.',
            icon: 'fa-table-cells-large',
            workspace: 'document-tools.html?tool=spreadsheet-intelligence',
            backendHandler: '/api/files/spreadsheet-intelligence',
            capabilities: ['tabular_qa', 'anomaly_detection']
        },
        // Feature 25: Automatic Chart Generator
        {
            id: 'chart-generator',
            name: 'Automatic Chart Generator',
            category: 'spreadsheet',
            supportedInputFormats: ['xlsx', 'xls', 'csv'],
            supportedOutputFormats: ['png', 'pdf'],
            description: 'Render Bar, Line, Pie, Comparison, and Trend charts from spreadsheet data.',
            icon: 'fa-chart-pie',
            workspace: 'document-tools.html?tool=generate-charts',
            backendHandler: '/api/files/generate-charts',
            capabilities: ['chart_render', 'chart_export']
        },
        // Feature 26: Smart Share Links
        {
            id: 'smart-share-links',
            name: 'Smart Share Links',
            category: 'security',
            supportedInputFormats: ['pdf', 'docx', 'xlsx', 'jpg', 'png', 'mp4', 'zip'],
            supportedOutputFormats: ['link'],
            description: 'Create secure expiration links (1h/1d/7d), password protection, download limit.',
            icon: 'fa-link',
            workspace: 'files.html?action=share',
            backendHandler: '/api/files/share-link',
            capabilities: ['expiration_link', 'password_protection']
        },
        // Feature 27: Temporary File Vault
        {
            id: 'temporary-vault',
            name: 'Temporary File Vault',
            category: 'security',
            supportedInputFormats: ['pdf', 'docx', 'xlsx', 'jpg', 'png', 'mp4', 'zip'],
            supportedOutputFormats: ['vault'],
            description: 'Secure temporary workspace with live expiration timer and auto-purging.',
            icon: 'fa-clock-rotate-left',
            workspace: 'files.html?vault=true',
            backendHandler: '/api/files/vault',
            capabilities: ['auto_purge', 'vault_timer']
        },
        // Feature 28: AI Workflow Builder
        {
            id: 'ai-workflow-builder',
            name: 'AI Workflow Builder',
            category: 'automation',
            supportedInputFormats: ['jpg', 'png', 'pdf', 'mp4', 'mp3'],
            supportedOutputFormats: ['pipeline'],
            description: 'Visual multi-step node pipeline generation from natural language commands.',
            icon: 'fa-diagram-project',
            workspace: 'tools.html?tool=workflow-builder',
            backendHandler: '/api/pipeline/builder',
            capabilities: ['visual_workflow', 'node_pipeline']
        },
        // Feature 29: Reusable Automation Recipes
        {
            id: 'automation-recipes',
            name: 'Reusable Automation Recipes',
            category: 'automation',
            supportedInputFormats: ['jpg', 'png', 'pdf', 'mp4', 'mp3'],
            supportedOutputFormats: ['recipe'],
            description: 'Save, run, edit, duplicate, and delete multi-operation workflows.',
            icon: 'fa-cubes',
            workspace: 'tools.html?tool=recipes',
            backendHandler: '/api/pipeline/recipes',
            capabilities: ['save_recipe', 'preset_execution']
        },
        // Feature 30: Universal Command Center
        {
            id: 'universal-command-bar',
            name: 'Universal DO ANYTHING Command',
            category: 'automation',
            supportedInputFormats: ['*'],
            supportedOutputFormats: ['*'],
            description: 'Primary Docholder natural language prompt bar to parse intent and execute workflows.',
            icon: 'fa-sparkles',
            workspace: 'dashboard.html',
            backendHandler: '/api/pipeline/builder',
            capabilities: ['intent_parsing', 'universal_execution']
        }
    ],

    getOperationsForFile(fileOrExt) {
        let ext = '';
        if (typeof fileOrExt === 'string') {
            ext = fileOrExt.toLowerCase().replace(/^\./, '');
        } else if (fileOrExt && fileOrExt.original_name) {
            ext = fileOrExt.original_name.split('.').pop().toLowerCase();
        }
        return this.operations.filter(op => op.supportedInputFormats.includes(ext));
    },

    getOperationById(id) {
        return this.operations.find(op => op.id === id) || null;
    }
};

window.ClientFormatRegistry = ClientFormatRegistry;
window.DocholderOperationRegistry = DocholderOperationRegistry;
