/**
 * Docholder Universal Conversion Registry
 * Scalable format mapping engine for universal file transformations.
 */

const FORMAT_CATEGORIES = {
    DOCUMENT: 'Documents',
    SPREADSHEET: 'Spreadsheets',
    PRESENTATION: 'Presentations',
    IMAGE: 'Images',
    VIDEO: 'Videos',
    AUDIO: 'Audio',
    TEXT_DATA: 'Text & Data',
    ARCHIVE: 'Archives'
};

const FORMAT_METADATA = {
    // Documents
    pdf: { ext: 'pdf', label: 'PDF Document', mime: 'application/pdf', category: FORMAT_CATEGORIES.DOCUMENT, icon: 'fa-file-pdf', color: '#EF4444' },
    docx: { ext: 'docx', label: 'Word Document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: FORMAT_CATEGORIES.DOCUMENT, icon: 'fa-file-word', color: '#3B82F6' },
    pdfa: { ext: 'pdf', label: 'PDF/A (Archival)', mime: 'application/pdf', category: FORMAT_CATEGORIES.DOCUMENT, icon: 'fa-file-shield', color: '#DC2626' },
    
    // Spreadsheets
    xlsx: { ext: 'xlsx', label: 'Excel Spreadsheet', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: FORMAT_CATEGORIES.SPREADSHEET, icon: 'fa-file-excel', color: '#10B981' },
    csv: { ext: 'csv', label: 'CSV Table', mime: 'text/csv', category: FORMAT_CATEGORIES.SPREADSHEET, icon: 'fa-file-csv', color: '#059669' },

    // Presentations
    pptx: { ext: 'pptx', label: 'PowerPoint Presentation', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: FORMAT_CATEGORIES.PRESENTATION, icon: 'fa-file-powerpoint', color: '#F97316' },

    // Images
    jpg: { ext: 'jpg', label: 'JPEG Image', mime: 'image/jpeg', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#8B5CF6' },
    jpeg: { ext: 'jpg', label: 'JPEG Image', mime: 'image/jpeg', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#8B5CF6' },
    png: { ext: 'png', label: 'PNG Image', mime: 'image/png', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#6366F1' },
    webp: { ext: 'webp', label: 'WebP Image', mime: 'image/webp', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#06B6D4' },
    tiff: { ext: 'tiff', label: 'TIFF Image', mime: 'image/tiff', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#EC4899' },
    bmp: { ext: 'bmp', label: 'BMP Image', mime: 'image/bmp', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#F59E0B' },
    gif: { ext: 'gif', label: 'GIF Animation', mime: 'image/gif', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-file-image', color: '#14B8A6' },
    svg: { ext: 'svg', label: 'SVG Vector', mime: 'image/svg+xml', category: FORMAT_CATEGORIES.IMAGE, icon: 'fa-bezier-curve', color: '#F43F5E' },

    // Video
    mp4: { ext: 'mp4', label: 'MP4 Video', mime: 'video/mp4', category: FORMAT_CATEGORIES.VIDEO, icon: 'fa-file-video', color: '#EC4899' },
    webm: { ext: 'webm', label: 'WebM Video', mime: 'video/webm', category: FORMAT_CATEGORIES.VIDEO, icon: 'fa-file-video', color: '#8B5CF6' },
    mov: { ext: 'mov', label: 'QuickTime Video', mime: 'video/quicktime', category: FORMAT_CATEGORIES.VIDEO, icon: 'fa-file-video', color: '#3B82F6' },
    avi: { ext: 'avi', label: 'AVI Video', mime: 'video/x-msvideo', category: FORMAT_CATEGORIES.VIDEO, icon: 'fa-file-video', color: '#6366F1' },
    mkv: { ext: 'mkv', label: 'MKV Video', mime: 'video/x-matroska', category: FORMAT_CATEGORIES.VIDEO, icon: 'fa-file-video', color: '#6D28D9' },

    // Audio
    mp3: { ext: 'mp3', label: 'MP3 Audio', mime: 'audio/mpeg', category: FORMAT_CATEGORIES.AUDIO, icon: 'fa-file-audio', color: '#10B981' },
    wav: { ext: 'wav', label: 'WAV Audio', mime: 'audio/wav', category: FORMAT_CATEGORIES.AUDIO, icon: 'fa-file-audio', color: '#06B6D4' },
    aac: { ext: 'aac', label: 'AAC Audio', mime: 'audio/aac', category: FORMAT_CATEGORIES.AUDIO, icon: 'fa-file-audio', color: '#3B82F6' },
    ogg: { ext: 'ogg', label: 'OGG Audio', mime: 'audio/ogg', category: FORMAT_CATEGORIES.AUDIO, icon: 'fa-file-audio', color: '#F59E0B' },
    m4a: { ext: 'm4a', label: 'M4A Audio', mime: 'audio/mp4', category: FORMAT_CATEGORIES.AUDIO, icon: 'fa-file-audio', color: '#6366F1' },
    flac: { ext: 'flac', label: 'FLAC Audio (Lossless)', mime: 'audio/flac', category: FORMAT_CATEGORIES.AUDIO, icon: 'fa-file-audio', color: '#14B8A6' },

    // Text & Data
    txt: { ext: 'txt', label: 'Plain Text', mime: 'text/plain', category: FORMAT_CATEGORIES.TEXT_DATA, icon: 'fa-file-lines', color: '#64748B' },
    html: { ext: 'html', label: 'HTML Webpage', mime: 'text/html', category: FORMAT_CATEGORIES.TEXT_DATA, icon: 'fa-code', color: '#F97316' },
    md: { ext: 'md', label: 'Markdown', mime: 'text/markdown', category: FORMAT_CATEGORIES.TEXT_DATA, icon: 'fa-hashtag', color: '#0EA5E9' },
    json: { ext: 'json', label: 'JSON Data', mime: 'application/json', category: FORMAT_CATEGORIES.TEXT_DATA, icon: 'fa-code-branch', color: '#FBBF24' },
    xml: { ext: 'xml', label: 'XML Data', mime: 'application/xml', category: FORMAT_CATEGORIES.TEXT_DATA, icon: 'fa-code', color: '#A855F7' },

    // Archive
    zip: { ext: 'zip', label: 'ZIP Archive', mime: 'application/zip', category: FORMAT_CATEGORIES.ARCHIVE, icon: 'fa-file-zipper', color: '#F59E0B' },
    tar: { ext: 'tar', label: 'TAR Archive', mime: 'application/x-tar', category: FORMAT_CATEGORIES.ARCHIVE, icon: 'fa-file-zipper', color: '#EAB308' },
    'tar.gz': { ext: 'tar.gz', label: 'GZIP Compressed TAR', mime: 'application/gzip', category: FORMAT_CATEGORIES.ARCHIVE, icon: 'fa-file-zipper', color: '#D97706' }
};

// Conversion Matrix: Input Ext -> Output Formats
const CONVERSION_MATRIX = {
    // PDF
    pdf: ['docx', 'pptx', 'xlsx', 'txt', 'html', 'md', 'jpg', 'png', 'pdfa'],

    // Word
    docx: ['pdf', 'pptx', 'txt', 'html', 'md'],
    doc: ['pdf', 'pptx', 'txt', 'html'],

    // Spreadsheets
    xlsx: ['pdf', 'csv', 'txt', 'html', 'json'],
    xls: ['pdf', 'csv', 'txt', 'html', 'json'],
    csv: ['xlsx', 'pdf', 'txt', 'html', 'json'],

    // Presentations
    pptx: ['pdf', 'docx', 'jpg', 'png', 'txt', 'html'],
    ppt: ['pdf', 'docx', 'jpg', 'png', 'txt'],

    // Images
    jpg: ['png', 'webp', 'pdf', 'tiff', 'bmp'],
    jpeg: ['png', 'webp', 'pdf', 'tiff', 'bmp'],
    png: ['jpg', 'webp', 'pdf', 'tiff', 'bmp'],
    webp: ['jpg', 'png', 'pdf', 'tiff', 'bmp'],
    tiff: ['jpg', 'png', 'webp', 'pdf'],
    tif: ['jpg', 'png', 'webp', 'pdf'],
    bmp: ['jpg', 'png', 'webp', 'pdf'],
    gif: ['jpg', 'png', 'webp', 'mp4'],
    svg: ['png', 'jpg', 'webp', 'pdf'],

    // Videos
    mp4: ['webm', 'mov', 'avi', 'mkv', 'gif', 'mp3', 'wav', 'aac'],
    webm: ['mp4', 'mov', 'gif', 'mp3', 'wav'],
    mov: ['mp4', 'webm', 'gif', 'mp3', 'wav'],
    avi: ['mp4', 'webm', 'gif', 'mp3', 'wav'],
    mkv: ['mp4', 'webm', 'gif', 'mp3', 'wav'],

    // Audio
    mp3: ['wav', 'aac', 'ogg', 'm4a', 'flac'],
    wav: ['mp3', 'aac', 'ogg', 'm4a', 'flac'],
    aac: ['mp3', 'wav', 'ogg'],
    ogg: ['mp3', 'wav', 'aac'],
    m4a: ['mp3', 'wav', 'aac'],
    flac: ['mp3', 'wav', 'aac', 'ogg'],

    // Text & Data
    txt: ['pdf', 'docx', 'html', 'md'],
    md: ['pdf', 'html', 'docx', 'txt'],
    html: ['pdf', 'txt', 'md'],
    json: ['txt', 'csv', 'xlsx', 'html'],
    xml: ['json', 'txt', 'html']
};

/**
 * Returns available conversion options grouped by category for a given file extension or MIME type
 */
function getAvailableConversions(extOrMime) {
    let cleanExt = (extOrMime || '').toLowerCase().trim();
    if (cleanExt.startsWith('.')) cleanExt = cleanExt.slice(1);

    // If MIME passed
    if (cleanExt.includes('/')) {
        const mimeMap = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/msword': 'docx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xlsx',
            'text/csv': 'csv',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/tiff': 'tiff',
            'image/bmp': 'bmp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/quicktime': 'mov',
            'video/x-msvideo': 'avi',
            'video/x-matroska': 'mkv',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/aac': 'aac',
            'audio/ogg': 'ogg',
            'audio/mp4': 'm4a',
            'audio/flac': 'flac',
            'text/plain': 'txt',
            'text/html': 'html',
            'text/markdown': 'md',
            'application/json': 'json',
            'application/xml': 'xml'
        };
        cleanExt = mimeMap[cleanExt] || 'txt';
    }

    const targetFormats = CONVERSION_MATRIX[cleanExt] || [];
    const grouped = {};

    targetFormats.forEach(targetExt => {
        const meta = FORMAT_METADATA[targetExt] || {
            ext: targetExt,
            label: targetExt.toUpperCase(),
            mime: 'application/octet-stream',
            category: FORMAT_CATEGORIES.TEXT_DATA,
            icon: 'fa-file',
            color: '#64748B'
        };

        if (!grouped[meta.category]) {
            grouped[meta.category] = [];
        }
        grouped[meta.category].push({
            format: targetExt,
            ...meta
        });
    });

    return {
        sourceExt: cleanExt,
        sourceMeta: FORMAT_METADATA[cleanExt] || null,
        targetFormats,
        grouped
    };
}

/**
 * Check if a conversion is supported
 */
function isConversionSupported(sourceExt, targetFormat) {
    const s = (sourceExt || '').toLowerCase().replace(/^\./, '');
    const t = (targetFormat || '').toLowerCase().replace(/^\./, '');
    const supported = CONVERSION_MATRIX[s] || [];
    return supported.includes(t);
}

module.exports = {
    FORMAT_CATEGORIES,
    FORMAT_METADATA,
    CONVERSION_MATRIX,
    getAvailableConversions,
    isConversionSupported
};
