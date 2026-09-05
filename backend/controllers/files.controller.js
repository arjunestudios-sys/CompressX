const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const FileType = require('file-type');
const db = require('../config/db');
const fileDetectionService = require('../services/fileDetection.service');
const compressionService = require('../services/compression.service');

const storageRoot = path.join(__dirname, '../storage');

function getCategoryFromMime(mimeType, filename) {
    const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif', 'svg'].includes(ext)) return 'image';
    if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('msword') || mimeType.includes('officedocument') || ['doc','docx','pdf','ppt','pptx','xls','xlsx'].includes(ext)) return 'doc';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed') || mimeType.includes('7z') || ['zip','tar','gz','rar','7z'].includes(ext)) return 'archive';
    if (mimeType.startsWith('text/') || ['txt','json','js','css','html','md','py','csv','xml'].includes(ext)) return 'text';
    return 'other';
}

exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided for upload.' });
        }

        const userId = req.user.id;
        const uploadedFilePath = req.file.path;
        const originalName = req.file.originalname;
        const storedName = req.file.filename;
        const fileSize = req.file.size;

        // Perform MIME sniffing using file-type package
        let detectedMime = req.file.mimetype;
        try {
            const detected = await FileType.fromFile(uploadedFilePath);
            if (detected && detected.mime) {
                detectedMime = detected.mime;
            }
        } catch(e) {}

        const category = getCategoryFromMime(detectedMime, originalName);

        // Check storage limit cap (500MB per user default)
        const storageLimit = parseInt(process.env.STORAGE_LIMIT_BYTES || '524288000', 10);
        if (req.user.storage_used + fileSize > storageLimit) {
            if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
            return res.status(400).json({ error: 'Storage cap exceeded. Please delete some files before uploading more.' });
        }

        // Save DB record
        const result = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, originalName, storedName, category, detectedMime, fileSize, uploadedFilePath);

        // Update user storage_used
        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(fileSize, userId);

        const newFile = db.prepare('SELECT * FROM files WHERE id = ?').get(result.lastInsertRowid);

        // Deep inspection & recommendations
        let inspection = null;
        try {
            inspection = await fileDetectionService.inspectFile(uploadedFilePath, originalName, detectedMime);
        } catch(e) {}

        return res.status(201).json({
            message: 'File uploaded successfully.',
            file: newFile,
            inspection
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        next(err);
    }
};

/**
 * Inspect file metadata and smart operation recommendations
 */
exports.inspectFile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const inspection = await fileDetectionService.inspectFile(sourcePath, file.original_name, file.mime_type);

        return res.json({
            file,
            inspection
        });
    } catch (err) {
        next(err);
    }
};

exports.listFiles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { category, sort, q } = req.query;

        let query = 'SELECT * FROM files WHERE user_id = ? AND status = "active"';
        const params = [userId];

        if (category && category !== 'all') {
            query += ' AND file_type = ?';
            params.push(category);
        }

        if (q && q.trim()) {
            query += ' AND original_name LIKE ?';
            params.push(`%${q.trim()}%`);
        }

        if (sort === 'name') {
            query += ' ORDER BY original_name ASC';
        } else if (sort === 'size') {
            query += ' ORDER BY file_size DESC';
        } else if (sort === 'type') {
            query += ' ORDER BY file_type ASC';
        } else {
            query += ' ORDER BY created_at DESC';
        }

        const files = db.prepare(query).all(...params);
        return res.json({ files });
    } catch (err) {
        next(err);
    }
};

exports.getFile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        return res.json({ file });
    } catch (err) {
        next(err);
    }
};

exports.downloadFile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const normalizedPath = path.normalize(file.storage_path);
        const resolvedPath = path.resolve(normalizedPath);

        if (!resolvedPath.toLowerCase().startsWith(path.resolve(storageRoot).toLowerCase()) || !fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found.' });
        }

        if (req.query.inline === 'true') {
            res.contentType(file.mime_type || 'application/octet-stream');
            res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
            return res.sendFile(resolvedPath);
        }

        return res.download(resolvedPath, file.original_name);
    } catch (err) {
        next(err);
    }
};

/**
 * Batch Download Multiple Files as ZIP
 */
exports.downloadMultipleAsZip = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'Please select at least 1 file.' });
        }

        const placeholders = fileIds.map(() => '?').join(',');
        const files = db.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ? AND status = "active"`).all(...fileIds, userId);

        if (files.length === 0) return res.status(404).json({ error: 'No files found.' });

        const userCompressedDir = path.join(storageRoot, 'compressed', String(userId));
        if (!fs.existsSync(userCompressedDir)) fs.mkdirSync(userCompressedDir, { recursive: true });

        const zipOriginalName = `docholder_export_${Date.now()}.zip`;
        const zipStoredName = `${crypto.randomUUID()}.zip`;
        const zipPath = path.join(userCompressedDir, zipStoredName);

        const stats = await compressionService.compressFiles(files, zipPath, 'zip', { level: 9 });

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, zipOriginalName, zipStoredName, 'archive', 'application/zip', stats.compressedSize, zipPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(stats.compressedSize, userId);
        const createdZip = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);

        return res.status(201).json({
            message: 'ZIP created successfully.',
            downloadUrl: `/api/files/${createdZip.id}/download`,
            zipFile: createdZip
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteFile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const normalizedPath = path.normalize(file.storage_path);
        if (fs.existsSync(normalizedPath)) {
            fs.unlinkSync(normalizedPath);
        }

        db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
        db.prepare('UPDATE users SET storage_used = MAX(0, storage_used - ?) WHERE id = ?').run(file.file_size, userId);

        return res.json({ message: 'File deleted successfully.' });
    } catch (err) {
        next(err);
    }
};

exports.renameFile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;
        let { newName } = req.body;

        if (!newName || !newName.trim()) {
            return res.status(400).json({ error: 'New name is required.' });
        }
        
        newName = newName.trim().replace(/[\/\\]/g, '');

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const lastDot = file.original_name.lastIndexOf('.');
        let ext = '';
        if (lastDot !== -1 && lastDot !== 0) {
            ext = file.original_name.substring(lastDot);
        }
        
        if (newName.toLowerCase().endsWith(ext.toLowerCase()) && ext !== '') {
            newName = newName.substring(0, newName.length - ext.length);
        }

        const finalOriginalName = newName + ext;

        const existing = db.prepare('SELECT id FROM files WHERE user_id = ? AND original_name = ? AND id != ? AND status = "active"').get(userId, finalOriginalName, fileId);
        if (existing) {
            return res.status(409).json({ error: 'A file with this name already exists.' });
        }

        const oldPhysicalPath = path.resolve(file.storage_path);
        if (!oldPhysicalPath.toLowerCase().startsWith(path.resolve(storageRoot).toLowerCase()) || !fs.existsSync(oldPhysicalPath)) {
            return res.status(404).json({ error: 'Original physical file not found on disk.' });
        }
        
        const userDir = path.dirname(oldPhysicalPath);
        let finalStoredName = finalOriginalName;
        let newPhysicalPath = path.join(userDir, finalStoredName);
        
        let counter = 1;
        while (fs.existsSync(newPhysicalPath)) {
            if (oldPhysicalPath === newPhysicalPath) break;
            finalStoredName = `${newName}(${counter})${ext}`;
            newPhysicalPath = path.join(userDir, finalStoredName);
            counter++;
        }
        
        if (oldPhysicalPath !== newPhysicalPath) {
            fs.renameSync(oldPhysicalPath, newPhysicalPath);
        }

        db.prepare('UPDATE files SET original_name = ?, stored_name = ?, storage_path = ? WHERE id = ?')
            .run(finalOriginalName, finalStoredName, newPhysicalPath, fileId);

        return res.json({ message: 'File renamed successfully.', newName: finalOriginalName });
    } catch (err) {
        next(err);
    }
};

exports.updateFileContent = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;
        const { content } = req.body;

        if (content === undefined) {
            return res.status(400).json({ error: 'Content is required.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        if (file.file_type !== 'text') {
            return res.status(400).json({ error: 'Only text-based files can be edited.' });
        }

        const normalizedPath = path.normalize(file.storage_path);
        const resolvedPath = path.resolve(normalizedPath);

        if (!resolvedPath.toLowerCase().startsWith(path.resolve(storageRoot).toLowerCase()) || !fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found on disk.' });
        }

        const oldSize = fs.statSync(resolvedPath).size;
        fs.writeFileSync(resolvedPath, content, 'utf8');
        const newSize = fs.statSync(resolvedPath).size;

        const sizeDiff = newSize - oldSize;

        db.prepare('UPDATE files SET file_size = ? WHERE id = ?').run(newSize, fileId);
        if (sizeDiff !== 0) {
            db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(sizeDiff, userId);
        }

        return res.json({ message: 'File content updated successfully.', newSize });
    } catch (err) {
        next(err);
    }
};

exports.saveWatermarkRemoved = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;
        const { base64Data, format } = req.body;

        if (!base64Data || !format) {
            return res.status(400).json({ error: 'Base64 data and format are required.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        if (!fs.existsSync(userConvertedDir)) fs.mkdirSync(userConvertedDir, { recursive: true });

        const originalNameBase = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${originalNameBase}_nowatermark.${format}`;
        const newStoredName = `${crypto.randomUUID()}.${format}`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const base64Content = base64Data.split(';base64,').pop();
        const buffer = Buffer.from(base64Content, 'base64');
        
        fs.writeFileSync(targetPath, buffer);
        const newSize = buffer.length;

        const mimeType = format === 'pdf' ? 'application/pdf' : (format === 'jpg' ? 'image/jpeg' : `image/${format}`);
        const category = format === 'pdf' ? 'doc' : 'image';

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, category, mimeType, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);

        return res.status(201).json({
            message: 'Watermark-removed file saved successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                downloadUrl: `/api/files/${createdFile.id}/download`
            }
        });
    } catch (err) {
        next(err);
    }
};
