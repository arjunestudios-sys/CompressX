const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const imageService = require('../services/image.service');

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
 * Convert Image
 */
exports.convertImage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, format, quality, pageSize, orientation, fit } = req.body;

        if (!fileId || !format) return res.status(400).json({ error: 'File ID and target format are required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const normFormat = format.toLowerCase() === 'jpg' ? 'jpeg' : format.toLowerCase();
        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const outExt = normFormat === 'jpeg' ? 'jpg' : normFormat;
        const newOriginalName = `${baseName}.${outExt}`;
        const newStoredName = `${crypto.randomUUID()}.${outExt}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await imageService.convertImage(sourcePath, targetPath, normFormat, { quality, pageSize, orientation, fit });

        const newSize = fs.statSync(targetPath).size;
        const mimeType = normFormat === 'pdf' ? 'application/pdf' : `image/${normFormat}`;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, normFormat === 'pdf' ? 'doc' : 'image', mimeType, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Convert to ${outExt.toUpperCase()}`, file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Image converted successfully.',
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
 * Compress Image (Quality or Target Size)
 */
exports.compressImage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, quality, targetSizeBytes, stripMetadata } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase().slice(1) || 'jpg';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_compressed.${ext}`;
        const newStoredName = `${crypto.randomUUID()}.${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await imageService.compressImage(sourcePath, targetPath, {
            quality,
            targetSizeBytes,
            stripMetadata
        });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'image', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Compress Image', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Image compressed successfully.',
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
 * Resize Image
 */
exports.resizeImage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, width, height, scale, preset, fit } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase().slice(1) || 'jpg';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_resized.${ext}`;
        const newStoredName = `${crypto.randomUUID()}.${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const resizeRes = await imageService.resizeImage(sourcePath, targetPath, { width, height, scale, preset, fit });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'image', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Resize Image', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Image resized successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                beforeDimensions: resizeRes.beforeDimensions,
                afterDimensions: resizeRes.afterDimensions,
                percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Crop Image
 */
exports.cropImage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, left, top, width, height } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase().slice(1) || 'jpg';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_cropped.${ext}`;
        const newStoredName = `${crypto.randomUUID()}.${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await imageService.cropImage(sourcePath, targetPath, { left, top, width, height });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'image', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Crop Image', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Image cropped successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Rotate & Flip Image
 */
exports.rotateFlipImage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, rotate, flip, flop } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase().slice(1) || 'jpg';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_transformed.${ext}`;
        const newStoredName = `${crypto.randomUUID()}.${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await imageService.rotateFlipImage(sourcePath, targetPath, { rotate, flip, flop });

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'image', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Rotate / Flip Image', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Image rotated/flipped successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: file.file_size,
                convertedSize: newSize,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Strip EXIF Metadata
 */
exports.stripExif = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const ext = path.extname(file.original_name).toLowerCase().slice(1) || 'jpg';
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_clean.${ext}`;
        const newStoredName = `${crypto.randomUUID()}.${ext}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        await imageService.stripMetadata(sourcePath, targetPath);

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'image', file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Strip EXIF Metadata', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'Image metadata removed successfully.',
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
 * Combine multiple images to single PDF
 */
exports.imagesToPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds, customName, pageSize, orientation, fit } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'Please select at least 1 image.' });
        }

        const placeholders = fileIds.map(() => '?').join(',');
        const files = db.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ? AND status = "active"`).all(...fileIds, userId);

        if (files.length === 0) return res.status(400).json({ error: 'No valid image files found.' });

        // STRICT SEQUENCE PRESERVATION: Image 1 -> Page 1, Image 2 -> Page 2, in exact user order
        const orderedFiles = [];
        for (const id of fileIds) {
            const found = files.find(f => String(f.id) === String(id));
            if (found) orderedFiles.push(found);
        }

        const imagePaths = orderedFiles.map(f => path.resolve(path.normalize(f.storage_path)));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = customName && customName.trim() ? customName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'images_combined';
        const newOriginalName = `${baseName}.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const pdfRes = await imageService.imagesToPdf(imagePaths, targetPath, { pageSize, orientation, fit });

        const totalOriginalSize = files.reduce((acc, f) => acc + f.file_size, 0);
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', pdfRes.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(pdfRes.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, `${files.length} Images`, newOriginalName, 'Images → PDF', totalOriginalSize, pdfRes.size, downloadUrl);

        return res.status(201).json({
            message: `Combined ${files.length} images into PDF successfully.`,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                pageCount: pdfRes.pageCount,
                convertedSize: pdfRes.size,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};
