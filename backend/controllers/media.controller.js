const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const mediaService = require('../services/media.service');
const transcriptionService = require('../services/transcription.service');

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
 * Get media file metadata
 */
exports.getMetadata = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;
        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const metadata = await mediaService.getMediaMetadata(sourcePath);
        return res.json({ file, metadata });
    } catch (err) {
        next(err);
    }
};

/**
 * Compress Video
 */
exports.compressVideo = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, quality, targetSizeBytes, resolution, fps, removeAudio } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_compressed.mp4`;
        const newStoredName = `${crypto.randomUUID()}.mp4`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.compressVideo(sourcePath, targetPath, {
            quality,
            targetSizeBytes,
            resolution,
            fps,
            removeAudio
        });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'video', 'video/mp4', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Compress Video', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Video compressed successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Convert Video format (MP4, WEBM, MOV, AVI, MKV, GIF)
 */
exports.convertVideo = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, format, fps, width, removeAudio } = req.body;

        if (!format) return res.status(400).json({ error: 'Target video format is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const normFormat = format.toLowerCase().trim();
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}.${normFormat}`;
        const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.convertVideo(sourcePath, targetPath, normFormat, { fps, width, removeAudio });

        const newSize = fs.statSync(targetPath).size;
        const mimeType = normFormat === 'gif' ? 'image/gif' : `video/${normFormat}`;
        const fileType = normFormat === 'gif' ? 'image' : 'video';

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, fileType, mimeType, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Convert to ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: `Video converted to ${normFormat.toUpperCase()} successfully.`,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Extract Audio from Video
 */
exports.extractAudio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, format = 'mp3', bitrate, sampleRate } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const normFormat = format.toLowerCase().trim();
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_audio.${normFormat}`;
        const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.extractAudio(sourcePath, targetPath, normFormat, { bitrate, sampleRate });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'audio', `audio/${normFormat === 'mp3' ? 'mpeg' : normFormat}`, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Extract ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: `Extracted ${normFormat.toUpperCase()} audio successfully.`,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Trim Video
 */
exports.trimVideo = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, startTime, endTime } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase() || '.mp4';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_trimmed${ext}`;
        const newStoredName = `${crypto.randomUUID()}${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.trimVideo(sourcePath, targetPath, parseFloat(startTime || 0), parseFloat(endTime || 10));

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'video', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Trim Video', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Video trimmed successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Convert Audio
 */
exports.convertAudio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, format, bitrate, sampleRate } = req.body;

        if (!format) return res.status(400).json({ error: 'Target audio format is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const normFormat = format.toLowerCase().trim();
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}.${normFormat}`;
        const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.convertAudio(sourcePath, targetPath, normFormat, { bitrate, sampleRate });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'audio', `audio/${normFormat === 'mp3' ? 'mpeg' : normFormat}`, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Convert to ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: `Audio converted to ${normFormat.toUpperCase()} successfully.`,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Compress Audio
 */
exports.compressAudio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, bitrate = '128k', sampleRate, mono } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_compressed.mp3`;
        const newStoredName = `${crypto.randomUUID()}.mp3`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.compressAudio(sourcePath, targetPath, { bitrate, sampleRate, mono });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'audio', 'audio/mpeg', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Compress Audio', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Audio compressed successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Trim Audio
 */
exports.trimAudio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, startTime, endTime } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase() || '.mp3';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_trimmed${ext}`;
        const newStoredName = `${crypto.randomUUID()}${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.trimAudio(sourcePath, targetPath, parseFloat(startTime || 0), parseFloat(endTime || 10));

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'audio', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Trim Audio', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Audio trimmed successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Transcribe Audio to Text
 */
exports.transcribeAudio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, customText } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'Audio file not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const transcriptResult = await transcriptionService.transcribeAudio(sourcePath, { customText });

        return res.json({
            message: 'Audio transcribed successfully.',
            fileId: file.id,
            fileName: file.original_name,
            result: transcriptResult
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Export Audio Transcript (TXT, DOCX, PDF)
 */
exports.exportTranscript = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, transcriptText, format } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'Audio file not found.' });

        const normFormat = (format || 'txt').toLowerCase().replace(/^\./, '');
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_transcript.${normFormat}`;
        const newStoredName = `${crypto.randomUUID()}.${normFormat}`;

        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);
        const targetPath = path.join(userConvertedDir, newStoredName);

        const exported = await transcriptionService.exportTranscript(transcriptText || '', baseName, normFormat, targetPath);

        let mimeType = 'text/plain';
        let fileType = 'text';
        if (normFormat === 'pdf') {
            mimeType = 'application/pdf';
            fileType = 'doc';
        } else if (normFormat === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            fileType = 'doc';
        }

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, fileType, mimeType, exported.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(exported.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Transcribe Audio (${normFormat.toUpperCase()})`, file.file_size, exported.size, downloadUrl);

        return res.status(201).json({
            message: `Transcript exported to ${normFormat.toUpperCase()} successfully.`,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                fileSize: exported.size,
                format: normFormat,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Merge Multiple Audio Files
 */
exports.mergeAudioFiles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
            return res.status(400).json({ error: 'Please select at least 2 audio files to merge.' });
        }

        const files = [];
        for (const id of fileIds) {
            const f = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(id, userId);
            if (f) files.push(f);
        }

        if (files.length < 2) {
            return res.status(400).json({ error: 'Valid audio files not found.' });
        }

        const inputPaths = files.map(f => path.resolve(path.normalize(f.storage_path)));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const newOriginalName = `merged_${Date.now()}.mp3`;
        const newStoredName = `${crypto.randomUUID()}.mp3`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.mergeAudio(inputPaths, targetPath);

        const newSize = fs.statSync(targetPath).size;
        const totalOrigSize = files.reduce((acc, f) => acc + f.file_size, 0);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'audio', 'audio/mpeg', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, `${files.length} Audio Files`, newOriginalName, 'Merge Audio', totalOrigSize, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Audio files merged successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                fileSize: newSize,
                downloadUrl
            }
        });
    } catch(err) {
        next(err);
    }
};

/**
 * Adjust Audio Volume
 */
exports.adjustAudioVolume = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, volumePercent } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'Audio file not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const factor = Math.max(0.1, Math.min(5.0, (parseFloat(volumePercent) || 100) / 100));
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_vol${Math.round(factor * 100)}pct.mp3`;
        const newStoredName = `${crypto.randomUUID()}.mp3`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.adjustVolume(sourcePath, targetPath, factor);

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'audio', 'audio/mpeg', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Adjust Volume (${Math.round(factor * 100)}%)`, file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Audio volume adjusted successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                fileSize: newSize,
                downloadUrl
            }
        });
    } catch(err) {
        next(err);
    }
};

/**
 * Merge Multiple Videos
 */
exports.mergeVideoFiles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
            return res.status(400).json({ error: 'Please select at least 2 video files to merge.' });
        }

        const files = [];
        for (const id of fileIds) {
            const f = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(id, userId);
            if (f) files.push(f);
        }

        if (files.length < 2) {
            return res.status(400).json({ error: 'Valid video files not found.' });
        }

        const inputPaths = files.map(f => path.resolve(path.normalize(f.storage_path)));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const newOriginalName = `merged_video_${Date.now()}.mp4`;
        const newStoredName = `${crypto.randomUUID()}.mp4`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.mergeVideos(inputPaths, targetPath);

        const newSize = fs.statSync(targetPath).size;
        const totalOrigSize = files.reduce((acc, f) => acc + f.file_size, 0);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'video', 'video/mp4', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, `${files.length} Videos`, newOriginalName, 'Merge Videos', totalOrigSize, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Videos merged successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                fileSize: newSize,
                downloadUrl
            }
        });
    } catch(err) {
        next(err);
    }
};

/**
 * Convert Video to GIF
 */
exports.convertVideoToGif = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, fps, width, duration, startTime } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'Video file not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}.gif`;
        const newStoredName = `${crypto.randomUUID()}.gif`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await mediaService.videoToGif(sourcePath, targetPath, {
            fps: parseInt(fps, 10) || 10,
            width: parseInt(width, 10) || 480,
            duration: parseInt(duration, 10) || 10,
            startTime: parseFloat(startTime) || 0
        });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'image', 'image/gif', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Video to GIF', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Video converted to GIF successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                fileSize: newSize,
                downloadUrl
            }
        });
    } catch(err) {
        next(err);
    }
};
