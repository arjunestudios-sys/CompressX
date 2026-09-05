const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const imageService = require('./image.service');
const mediaService = require('./media.service');
const documentService = require('./document.service');
const compressionService = require('./compression.service');

const storageRoot = path.join(__dirname, '../storage');
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function recordTransformation(userId, origName, resultName, actionType, origSize, resultSize, downloadUrl) {
    try {
        const savedPercent = origSize > 0 ? Math.max(0, Math.round((1 - (resultSize / origSize)) * 100)) : 0;
        db.prepare(`
            INSERT INTO transformations (user_id, original_name, result_name, action_type, original_size, result_size, percentage_saved, download_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, origName, resultName, actionType, origSize, resultSize, savedPercent, downloadUrl);
    } catch(e) {
        console.warn('Failed to record transformation:', e);
    }
}

/**
 * Execute a sequential or branched multi-step pipeline
 * Steps: array of { operation, options }
 */
async function executePipeline(userIdOrPath, initialFileOrSteps, stepsArray = []) {
    let userId = 1;
    let initialFile = initialFileOrSteps;
    let steps = stepsArray;

    if (typeof userIdOrPath === 'string' && (typeof initialFileOrSteps === 'string' || Array.isArray(initialFileOrSteps))) {
        if (Array.isArray(initialFileOrSteps)) {
            // Called as executePipeline(inputPath, steps)
            steps = initialFileOrSteps;
            initialFile = {
                id: 0,
                original_name: path.basename(userIdOrPath),
                storage_path: userIdOrPath,
                file_size: fs.existsSync(userIdOrPath) ? fs.statSync(userIdOrPath).size : 0,
                file_type: 'image'
            };
            userId = 'system';
        } else if (Array.isArray(stepsArray)) {
            // Called as executePipeline(inputPath, outputPath, steps)
            steps = stepsArray;
            initialFile = {
                id: 0,
                original_name: path.basename(userIdOrPath),
                storage_path: userIdOrPath,
                file_size: fs.existsSync(userIdOrPath) ? fs.statSync(userIdOrPath).size : 0,
                file_type: 'image'
            };
            userId = 'system';
        }
    } else {
        userId = userIdOrPath || 1;
    }

    if (!initialFile) throw new Error('Source file required for pipeline execution.');
    if (!steps || steps.length === 0) throw new Error('At least one pipeline step is required.');

    const safeUserDirName = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const userConvertedDir = path.join(storageRoot, 'converted', safeUserDirName);
    ensureDir(userConvertedDir);

    let currentFile = initialFile;
    const executedSteps = [];
    const createdFiles = [];

    const origName = initialFile.original_name || path.basename(initialFile.storage_path || 'file');
    const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const opts = step.options || step.params || {};
        const stepName = step.operation || `Step ${i + 1}`;
        const sourcePath = path.resolve(path.normalize(currentFile.storage_path));
        const mimeType = currentFile.mime_type || (currentFile.file_type === 'image' ? 'image/png' : 'application/octet-stream');

        let outExt = path.extname(currentFile.original_name || currentFile.storage_path).toLowerCase().replace(/^\./, '') || 'dat';
        let actionLabel = stepName;

        if (step.operation === 'convert') {
            outExt = (opts.targetFormat || opts.format || 'webp').toLowerCase();
            actionLabel = `Convert to ${outExt.toUpperCase()}`;
        } else if (step.operation === 'extract_audio') {
            outExt = (opts.targetFormat || opts.format || 'mp3').toLowerCase();
            actionLabel = `Extract ${outExt.toUpperCase()}`;
        } else if (step.operation === 'compress') {
            actionLabel = `Compress (${opts.quality || 'Optimal'})`;
        } else if (step.operation === 'resize') {
            actionLabel = `Resize (${opts.resolution || opts.preset || 'Scaled'})`;
        }

        const newStoredName = `${crypto.randomUUID()}.${outExt}`;
        const targetPath = path.join(userConvertedDir, newStoredName);
        const newOriginalName = `${baseName}_p${i + 1}.${outExt}`;

        let stepResult = null;

        if (step.operation === 'convert') {
            if (mimeType.startsWith('image/')) {
                stepResult = await imageService.convertImage(sourcePath, targetPath, outExt, opts);
            } else if (mimeType.startsWith('video/')) {
                stepResult = await mediaService.convertVideo(sourcePath, targetPath, outExt, opts);
            } else if (mimeType.startsWith('audio/')) {
                stepResult = await mediaService.convertAudio(sourcePath, targetPath, outExt, opts);
            }
        } else if (step.operation === 'extract_audio') {
            stepResult = await mediaService.extractAudio(sourcePath, targetPath, outExt, opts);
        } else if (step.operation === 'compress') {
            if (mimeType.startsWith('image/')) {
                stepResult = await imageService.compressImage(sourcePath, targetPath, opts);
            } else if (mimeType.startsWith('video/')) {
                stepResult = await mediaService.compressVideo(sourcePath, targetPath, opts);
            } else if (mimeType.startsWith('audio/')) {
                stepResult = await mediaService.compressAudio(sourcePath, targetPath, opts);
            } else {
                await compressionService.compressFiles([currentFile], targetPath, 'zip', { level: 9 });
                stepResult = { outputPath: targetPath };
            }
        } else if (step.operation === 'resize') {
            if (mimeType.startsWith('image/')) {
                stepResult = await imageService.resizeImage(sourcePath, targetPath, opts);
            } else if (mimeType.startsWith('video/')) {
                stepResult = await mediaService.compressVideo(sourcePath, targetPath, { resolution: opts.resolution || opts.preset || '720p' });
            }
        } else if (step.operation === 'strip_exif') {
            stepResult = await imageService.stripMetadata(sourcePath, targetPath);
        }

        const newSize = fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
        let outMimeType = 'application/octet-stream';
        let outFileType = 'doc';

        if (['jpg', 'jpeg', 'png', 'webp', 'tiff', 'gif', 'bmp'].includes(outExt)) {
            outMimeType = `image/${outExt === 'jpg' ? 'jpeg' : outExt}`;
            outFileType = 'image';
        } else if (['mp4', 'webm', 'mov', 'avi'].includes(outExt)) {
            outMimeType = `video/${outExt}`;
            outFileType = 'video';
        } else if (['mp3', 'wav', 'aac', 'ogg'].includes(outExt)) {
            outMimeType = `audio/${outExt === 'mp3' ? 'mpeg' : outExt}`;
            outFileType = 'audio';
        } else if (outExt === 'pdf') {
            outMimeType = 'application/pdf';
            outFileType = 'doc';
        }

        // Save DB File
        let createdRecord = null;
        let downloadUrl = `/api/files/download`;
        if (typeof userId === 'number') {
            const fileResult = db.prepare(`
                INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userId, newOriginalName, newStoredName, outFileType, outMimeType, newSize, targetPath);

            db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
            createdRecord = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
            downloadUrl = `/api/files/${createdRecord.id}/download`;
            recordTransformation(userId, currentFile.original_name, newOriginalName, actionLabel, currentFile.file_size, newSize, downloadUrl);
        } else {
            createdRecord = {
                id: i + 1,
                original_name: newOriginalName,
                stored_name: newStoredName,
                file_size: newSize,
                storage_path: targetPath,
                file_type: outFileType,
                mime_type: outMimeType
            };
        }

        executedSteps.push({
            step: i + 1,
            name: actionLabel,
            inputName: currentFile.original_name,
            outputName: newOriginalName,
            outputSize: newSize,
            savedPercentage: currentFile.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / currentFile.file_size)) * 100)) : 0,
            fileId: createdRecord ? createdRecord.id : null,
            downloadUrl
        });

        createdFiles.push(createdRecord);
        currentFile = createdRecord; // pass forward to next chained pipeline step
    }

    return {
        initialFile: {
            id: initialFile.id,
            name: initialFile.original_name,
            size: initialFile.file_size
        },
        finalFile: {
            id: currentFile.id,
            name: currentFile.original_name,
            size: currentFile.file_size,
            downloadUrl: `/api/files/${currentFile.id}/download`
        },
        steps: executedSteps,
        totalSavedPercent: initialFile.file_size > 0 ? Math.max(0, Math.round((1 - (currentFile.file_size / initialFile.file_size)) * 100)) : 0
    };
}

module.exports = {
    executePipeline
};
