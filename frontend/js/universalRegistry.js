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
            description: 'Reduce PDF file size with smart stream, font, and object optimization.',
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
            description: 'Secure your document with standard password encryption and fine-grained permissions.',
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
            description: 'Draw, type, or upload an authentic signature and stamp directly onto any page.',
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
            description: 'Add highlights, notes, stamps, and shapes directly embedded into the document.',
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
            description: 'Permanently blackout sensitive personal, financial, or confidential data.',
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
            description: 'Combine multiple PDF documents into a single organized file.',
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
            description: 'Extract specific page ranges into a separate document.',
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
            description: 'Edit text, find and replace content, format paragraphs, and export to PDF.',
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

        // Audio Operations
        {
            id: 'audio-transcribe',
            name: 'Audio → Text',
            category: 'audio',
            supportedInputFormats: ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'],
            supportedOutputFormats: ['txt', 'docx', 'pdf'],
            description: 'Transcribe speech into formatted editable text with export to TXT, DOCX, and PDF.',
            icon: 'fa-file-lines',
            workspace: 'audio-tools.html?tool=transcribe',
            backendHandler: '/api/media/transcribe',
            capabilities: ['timestamps', 'export_txt', 'export_docx', 'export_pdf']
        },
        {
            id: 'audio-compress',
            name: 'Compress Audio',
            category: 'audio',
            supportedInputFormats: ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'],
            supportedOutputFormats: ['mp3', 'aac'],
            description: 'Optimize audio bitrate and channels for podcasts, music, and voice notes.',
            icon: 'fa-compress',
            workspace: 'audio-tools.html?tool=compress',
            backendHandler: '/api/media/compress-audio'
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
