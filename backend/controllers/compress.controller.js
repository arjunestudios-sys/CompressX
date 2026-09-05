const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const compressionService = require('../services/compression.service');

exports.compressFiles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds, format = 'zip', customName, level, password, deleteOriginals } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'Please select at least one file to compress.' });
        }

        // Fetch selected files owned by user
        const placeholders = fileIds.map(() => '?').join(',');
        const files = db.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ? AND status = "active"`).all(...fileIds, userId);

        if (files.length === 0) {
            return res.status(400).json({ error: 'No valid files found to compress.' });
        }

        // Determine output archive name
        let ext = format;
        if (format !== 'tar' && format !== 'tar.gz') ext = 'zip';

        let archiveBaseName = 'archive';

        if (files.length === 1) {
            const singleName = files[0].original_name;
            const dotIdx = singleName.lastIndexOf('.');
            archiveBaseName = dotIdx > 0 ? singleName.substring(0, dotIdx) : singleName;
        } else if (customName && customName.trim()) {
            archiveBaseName = customName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        }

        const archiveOriginalName = `${archiveBaseName}.compress.${ext}`;
        const archiveStoredName = `${crypto.randomUUID()}.${ext}`;

        const userCompressedDir = path.join(__dirname, '../storage/compressed', String(userId));
        const outputPath = path.join(userCompressedDir, archiveStoredName);

        // Run compression stream service
        const stats = await compressionService.compressFiles(files, outputPath, format, { level, password });

        // Record compressed archive in files table
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, archiveOriginalName, archiveStoredName, 'archive', `application/${ext}`, stats.compressedSize, outputPath);

        // Update user storage_used for the new archive
        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(stats.compressedSize, userId);

        // Delete originals if requested
        if (deleteOriginals) {
            for (const f of files) {
                const normalizedPath = path.normalize(f.storage_path);
                if (fs.existsSync(normalizedPath)) {
                    fs.unlinkSync(normalizedPath);
                }
                db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
                db.prepare('UPDATE users SET storage_used = MAX(0, storage_used - ?) WHERE id = ?').run(f.file_size, userId);
            }
        }

        // Record in compression_history
        const origFileNames = files.map(f => f.original_name).join(', ');
        db.prepare(`
            INSERT INTO compression_history (user_id, original_file, compressed_file, original_size, compressed_size, compression_percentage, compression_format)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, origFileNames, archiveOriginalName, stats.originalSize, stats.compressedSize, stats.percentageSaved, format.toUpperCase());

        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);

        return res.status(201).json({
            message: 'Files compressed successfully.',
            jobId: createdFile.id,
            result: {
                id: createdFile.id,
                originalName: archiveOriginalName,
                originalSize: stats.originalSize,
                compressedSize: stats.compressedSize,
                percentageSaved: stats.percentageSaved,
                format: format.toUpperCase(),
                downloadUrl: `/api/files/${createdFile.id}/download`
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getCompressionStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const jobId = req.params.jobId;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(jobId, userId);
        if (!file) {
            return res.status(404).json({ error: 'Compression job not found.' });
        }

        return res.json({
            jobId: file.id,
            status: 'completed',
            file
        });
    } catch (err) {
        next(err);
    }
};
