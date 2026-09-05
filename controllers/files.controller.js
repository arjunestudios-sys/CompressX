const path = require('path');
const fs = require('fs');
const FileType = require('file-type');
const db = require('../config/db');

const storageRoot = path.join(__dirname, '../storage');

function getCategoryFromMime(mimeType, filename) {
    const ext = path.extname(filename).toLowerCase();
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('msword') || mimeType.includes('officedocument') || ['doc','docx','pdf','ppt','pptx','xls','xlsx'].includes(ext.slice(1))) return 'doc';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed') || mimeType.includes('7z') || ['zip','tar','gz','rar','7z'].includes(ext.slice(1))) return 'archive';
    if (mimeType.startsWith('text/') || ['txt','json','js','css','html','md','py','csv'].includes(ext.slice(1))) return 'text';
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
            // Delete uploaded file
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

        return res.status(201).json({
            message: 'File uploaded successfully.',
            file: newFile
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
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
        if (!fs.existsSync(normalizedPath)) {
            return res.status(404).json({ error: 'File not found on server.' });
        }

        return res.download(normalizedPath, file.original_name);
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
