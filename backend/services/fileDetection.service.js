const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const mediaService = require('./media.service');
const { getAvailableConversions, FORMAT_METADATA } = require('./conversionRegistry');

/**
 * Universal File Detection & Deep Inspection Engine
 */
async function inspectFile(filePath, originalName, mimeType) {
    const ext = path.extname(originalName).toLowerCase().replace(/^\./, '');
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : { size: 0 };
    const fileSize = stats.size;

    let category = 'other';
    let details = {
        dimensions: null,
        duration: null,
        durationFormatted: null,
        pageCount: null,
        codec: null,
        fps: null,
        bitrate: null,
        hasAudio: false,
        hasVideo: false
    };

    // Category Determination
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif', 'svg'].includes(ext)) {
        category = 'image';
        try {
            const meta = await sharp(filePath).metadata();
            details.dimensions = meta.width && meta.height ? `${meta.width} × ${meta.height}` : null;
            details.width = meta.width;
            details.height = meta.height;
            details.format = meta.format;
            details.channels = meta.channels;
            details.hasAlpha = meta.hasAlpha;
        } catch(e) {}
    } else if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
        category = 'video';
        try {
            const mediaMeta = await mediaService.getMediaMetadata(filePath);
            details.dimensions = mediaMeta.resolution;
            details.duration = mediaMeta.duration;
            details.durationFormatted = mediaMeta.durationFormatted;
            details.fps = mediaMeta.fps;
            details.bitrate = mediaMeta.bitrate;
            details.codec = mediaMeta.videoCodec;
            details.hasAudio = mediaMeta.hasAudio;
            details.hasVideo = true;
        } catch(e) {}
    } else if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'].includes(ext)) {
        category = 'audio';
        try {
            const mediaMeta = await mediaService.getMediaMetadata(filePath);
            details.duration = mediaMeta.duration;
            details.durationFormatted = mediaMeta.durationFormatted;
            details.bitrate = mediaMeta.bitrate;
            details.codec = mediaMeta.audioCodec;
            details.hasAudio = true;
        } catch(e) {}
    } else if (mimeType.includes('pdf') || ext === 'pdf') {
        category = 'doc';
        try {
            const pdfBytes = fs.readFileSync(filePath);
            const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            details.pageCount = pdfDoc.getPageCount();
        } catch(e) {}
    } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
        category = 'doc';
    } else if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext) || mimeType.includes('zip') || mimeType.includes('tar')) {
        category = 'archive';
    } else if (['txt', 'csv', 'json', 'xml', 'md', 'html', 'js', 'py'].includes(ext) || mimeType.startsWith('text/')) {
        category = 'text';
    }

    // Smart Recommendations & Operations
    const recommendations = getSmartRecommendations(category, ext, details);
    const conversions = getAvailableConversions(ext);

    return {
        filename: originalName,
        extension: ext,
        mimeType,
        category,
        fileSize,
        details,
        recommendations,
        conversions
    };
}

/**
 * Generate 3-5 smart recommended actions based on file type and properties
 */
function getSmartRecommendations(category, ext, details) {
    const recs = [];

    if (category === 'video') {
        recs.push({
            id: 'compress_video',
            label: 'Compress Video',
            icon: 'fa-compress',
            action: 'compress',
            description: 'Reduce file size while keeping crisp quality'
        });
        if (details.hasAudio !== false) {
            recs.push({
                id: 'extract_mp3',
                label: 'Extract MP3',
                icon: 'fa-music',
                action: 'extract_audio',
                targetFormat: 'mp3',
                description: 'Extract audio track as MP3'
            });
        }
        recs.push({
            id: 'convert_format',
            label: 'Convert Format',
            icon: 'fa-rotate',
            action: 'convert',
            description: 'Convert to WEBM, MOV, GIF or MP4'
        });
        recs.push({
            id: 'resize_video',
            label: 'Resize Resolution',
            icon: 'fa-expand',
            action: 'resize',
            description: 'Downscale to 1080p, 720p or 480p'
        });
        recs.push({
            id: 'trim_video',
            label: 'Trim Video',
            icon: 'fa-scissors',
            action: 'trim',
            description: 'Cut start and end timestamps'
        });
    } else if (category === 'image') {
        recs.push({
            id: 'compress_image',
            label: 'Compress Image',
            icon: 'fa-compress',
            action: 'compress',
            description: 'Optimize with custom or target size'
        });
        if (ext !== 'webp') {
            recs.push({
                id: 'convert_webp',
                label: 'Convert to WebP',
                icon: 'fa-bolt',
                action: 'convert',
                targetFormat: 'webp',
                description: 'Modern high-efficiency WebP format'
            });
        } else {
            recs.push({
                id: 'convert_png',
                label: 'Convert to PNG',
                icon: 'fa-image',
                action: 'convert',
                targetFormat: 'png',
                description: 'Lossless PNG format'
            });
        }
        recs.push({
            id: 'resize_image',
            label: 'Resize Dimensions',
            icon: 'fa-up-right-and-down-left-from-center',
            action: 'resize',
            description: 'Scale or change width/height'
        });
        recs.push({
            id: 'image_to_pdf',
            label: 'Convert to PDF',
            icon: 'fa-file-pdf',
            action: 'convert',
            targetFormat: 'pdf',
            description: 'Wrap image in a clean PDF page'
        });
        recs.push({
            id: 'strip_metadata',
            label: 'Remove EXIF Metadata',
            icon: 'fa-shield-halved',
            action: 'strip_exif',
            description: 'Protect privacy by wiping camera metadata'
        });
    } else if (category === 'audio') {
        recs.push({
            id: 'compress_audio',
            label: 'Compress Audio',
            icon: 'fa-compress',
            action: 'compress',
            description: 'Reduce bitrate to save storage'
        });
        if (ext !== 'mp3') {
            recs.push({
                id: 'convert_mp3',
                label: 'Convert to MP3',
                icon: 'fa-music',
                action: 'convert',
                targetFormat: 'mp3',
                description: 'Universal MP3 audio'
            });
        } else {
            recs.push({
                id: 'convert_wav',
                label: 'Convert to WAV',
                icon: 'fa-wave-square',
                action: 'convert',
                targetFormat: 'wav',
                description: 'Uncompressed high-fidelity audio'
            });
        }
        recs.push({
            id: 'trim_audio',
            label: 'Trim Audio',
            icon: 'fa-scissors',
            action: 'trim',
            description: 'Cut audio track range'
        });
    } else if (category === 'doc' && ext === 'pdf') {
        recs.push({
            id: 'compress_pdf',
            label: 'Compress PDF',
            icon: 'fa-compress',
            action: 'compress',
            description: 'Reduce document size'
        });
        recs.push({
            id: 'convert_word',
            label: 'Convert to Word',
            icon: 'fa-file-word',
            action: 'convert',
            targetFormat: 'docx',
            description: 'Editable Microsoft Word document'
        });
        recs.push({
            id: 'pdf_merge',
            label: 'Merge PDFs',
            icon: 'fa-object-group',
            action: 'merge',
            description: 'Combine multiple PDF files'
        });
        recs.push({
            id: 'pdf_split',
            label: 'Split Pages',
            icon: 'fa-scissors',
            action: 'split',
            description: 'Extract or separate pages'
        });
        recs.push({
            id: 'pdf_watermark',
            label: 'Add Watermark',
            icon: 'fa-stamp',
            action: 'watermark',
            description: 'Stamp custom watermark text'
        });
    } else if (category === 'doc' && (ext === 'docx' || ext === 'doc')) {
        recs.push({
            id: 'convert_pdf',
            label: 'Convert to PDF',
            icon: 'fa-file-pdf',
            action: 'convert',
            targetFormat: 'pdf',
            description: 'Standardized PDF document'
        });
        recs.push({
            id: 'convert_txt',
            label: 'Extract Plain Text',
            icon: 'fa-file-lines',
            action: 'convert',
            targetFormat: 'txt',
            description: 'Extract all textual content'
        });
        recs.push({
            id: 'convert_html',
            label: 'Convert to HTML',
            icon: 'fa-code',
            action: 'convert',
            targetFormat: 'html',
            description: 'Formatted web document'
        });
    } else if (ext === 'xlsx' || ext === 'csv') {
        recs.push({
            id: 'convert_csv_xlsx',
            label: ext === 'xlsx' ? 'Convert to CSV' : 'Convert to Excel (.xlsx)',
            icon: 'fa-table',
            action: 'convert',
            targetFormat: ext === 'xlsx' ? 'csv' : 'xlsx',
            description: 'Transform tabular data'
        });
        recs.push({
            id: 'convert_pdf_sheet',
            label: 'Export to PDF',
            icon: 'fa-file-pdf',
            action: 'convert',
            targetFormat: 'pdf',
            description: 'Printable spreadsheet view'
        });
    } else {
        recs.push({
            id: 'make_smaller',
            label: 'Make It Smaller',
            icon: 'fa-compress',
            action: 'smart_compress',
            description: 'Universal compression'
        });
        recs.push({
            id: 'create_zip',
            label: 'Create ZIP Archive',
            icon: 'fa-file-zipper',
            action: 'zip',
            description: 'Package into secure ZIP'
        });
    }

    return recs;
}

module.exports = {
    inspectFile,
    getSmartRecommendations
};
