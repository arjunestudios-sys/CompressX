const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument, rgb } = require('pdf-lib');
const db = require('../config/db');
const documentService = require('../services/document.service');

const storageRoot = path.join(__dirname, '../storage');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
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

exports.annotatePdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;
        const { annotations } = req.body;

        if (!annotations || !Array.isArray(annotations)) {
            return res.status(400).json({ error: 'Annotations array is required.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        if (file.file_type !== 'doc' || !file.mime_type.includes('pdf')) {
            return res.status(400).json({ error: 'Only PDF files can be annotated.' });
        }

        const resolvedPath = path.resolve(path.normalize(file.storage_path));
        if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File not found on disk.' });

        const existingPdfBytes = fs.readFileSync(resolvedPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();

        for (const ann of annotations) {
            const pageIndex = parseInt(ann.page, 10);
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const page = pages[pageIndex];
                const pageHeight = page.getHeight();
                const c = hexToRgb(ann.color || '#000000');
                
                page.drawText(ann.text, {
                    x: parseFloat(ann.x),
                    y: pageHeight - parseFloat(ann.y), 
                    size: parseInt(ann.fontSize || 12, 10),
                    color: rgb(c.r, c.g, c.b),
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        const oldSize = fs.statSync(resolvedPath).size;
        fs.writeFileSync(resolvedPath, pdfBytes);
        const newSize = fs.statSync(resolvedPath).size;
        const sizeDiff = newSize - oldSize;

        db.prepare('UPDATE files SET file_size = ? WHERE id = ?').run(newSize, fileId);
        if (sizeDiff !== 0) {
            db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(sizeDiff, userId);
        }

        return res.json({ message: 'PDF annotated successfully.', newSize });
    } catch (err) {
        next(err);
    }
};

// Native PDF Compression Engine
exports.compressPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, level = 'recommended' } = req.body;

        if (!fileId) return res.status(400).json({ error: 'File ID is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'PDF file not found in your workspace.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'Source file not found on disk.' });

        const sourceBytes = fs.readFileSync(sourcePath);
        let srcDoc;
        try {
            srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
        } catch(e) {
            return res.status(400).json({ error: `Unable to compress: "${file.original_name}" is invalid or corrupted.` });
        }

        const userConvertedDir = path.join(storageRoot, 'compressed', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_compressed.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        // Compress using PDFLib object streams and stream compression
        const compressedBytes = await srcDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50
        });

        const origSize = file.file_size || sourceBytes.length;
        let finalBytes = compressedBytes;
        let cannotCompressFurther = false;

        // Check if compression achieved reduction
        if (compressedBytes.length >= origSize) {
            finalBytes = sourceBytes;
            cannotCompressFurther = true;
        }

        fs.writeFileSync(targetPath, finalBytes);
        const finalSize = fs.statSync(targetPath).size;
        const savedPercent = origSize > 0 ? Math.max(0, Math.round((1 - (finalSize / origSize)) * 100)) : 0;

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', finalSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(finalSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Compress PDF', origSize, finalSize, downloadUrl);

        return res.status(201).json({
            message: cannotCompressFurther 
                ? 'This PDF cannot be compressed further significantly.' 
                : 'PDF compressed successfully.',
            cannotCompressFurther,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: origSize,
                convertedSize: finalSize,
                percentageSaved: savedPercent,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

// Merge Multiple PDFs with Sequence Preservation and Individual Validation
exports.mergePdfs = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds, customName } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
            return res.status(400).json({ error: 'Please select at least 2 PDF files to merge.' });
        }

        const placeholders = fileIds.map(() => '?').join(',');
        const files = db.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ? AND status = "active"`).all(...fileIds, userId);

        if (files.length < 2) {
            return res.status(400).json({ error: 'At least 2 valid PDF files are required to merge.' });
        }

        // STRICT SEQUENCE PRESERVATION: Maintain exact client ordering
        const orderedFiles = [];
        for (const id of fileIds) {
            const found = files.find(f => String(f.id) === String(id));
            if (found) orderedFiles.push(found);
        }

        if (orderedFiles.length < 2) {
            return res.status(400).json({ error: 'Please select at least 2 existing PDF files in order.' });
        }

        // INDIVIDUAL VALIDATION: Check each PDF individually
        const pdfPaths = [];
        for (const file of orderedFiles) {
            const p = path.resolve(path.normalize(file.storage_path));
            if (!fs.existsSync(p)) {
                return res.status(400).json({ error: `Unable to merge: "${file.original_name}" was not found on disk.` });
            }
            try {
                const b = fs.readFileSync(p);
                await PDFDocument.load(b, { ignoreEncryption: true });
            } catch(e) {
                return res.status(400).json({ error: `Unable to merge: "${file.original_name}" is invalid or corrupted.` });
            }
            pdfPaths.push(p);
        }

        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = customName && customName.trim() ? customName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'merged_document';
        const newOriginalName = `${baseName}.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.mergePdfs(pdfPaths, targetPath);

        const totalOriginalSize = orderedFiles.reduce((acc, f) => acc + f.file_size, 0);
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, `${orderedFiles.length} PDFs`, newOriginalName, 'Merge PDFs', totalOriginalSize, result.size, downloadUrl);

        return res.status(201).json({
            message: 'PDFs merged successfully.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                pageCount: result.pageCount,
                fileSize: result.size,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

// Split PDF by page range
exports.splitPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, fromPage, toPage } = req.body;

        if (!fileId) return res.status(400).json({ error: 'File ID is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'File not found on disk.' });

        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const start = Math.max(1, parseInt(fromPage, 10) || 1);
        const end = parseInt(toPage, 10) || start;

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_pages_${start}-${end}.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const pageIndices = [];
        for (let i = start - 1; i < end; i++) pageIndices.push(i);

        const result = await documentService.extractPages(sourcePath, targetPath, pageIndices);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Split PDF', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: `Extracted pages ${start} to ${end} successfully.`,
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                pageCount: result.pageCount,
                fileSize: result.size,
                downloadUrl
            }
        });
    } catch (err) {
        next(err);
    }
};

// Extract Pages (comma-separated, e.g. "1, 3, 5")
exports.extractPages = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, pages } = req.body; // array of 1-based page numbers e.g. [1, 3, 5]

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const pageIndices = (pages || []).map(p => parseInt(p, 10) - 1).filter(i => !isNaN(i) && i >= 0);
        if (pageIndices.length === 0) return res.status(400).json({ error: 'Please provide at least one valid page number.' });

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_extracted.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.extractPages(sourcePath, targetPath, pageIndices);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Extract Pages', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: `Extracted ${result.pageCount} pages successfully.`,
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Remove Pages
exports.removePages = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, pages } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const pageIndicesToRemove = (pages || []).map(p => parseInt(p, 10) - 1).filter(i => !isNaN(i) && i >= 0);
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_modified.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.removePages(sourcePath, targetPath, pageIndicesToRemove);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Remove Pages', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: `Removed specified pages successfully (${result.pageCount} pages remaining).`,
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Rotate PDF
exports.rotatePdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, degrees = 90, pages } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const pageIndices = pages && Array.isArray(pages) ? pages.map(p => parseInt(p, 10) - 1) : null;
        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_rotated.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.rotatePdf(sourcePath, targetPath, parseInt(degrees, 10) || 90, pageIndices);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Rotate PDF (${degrees}°)`, file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: `Rotated PDF by ${degrees}° successfully.`,
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Watermark PDF
exports.watermarkPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, text = 'CONFIDENTIAL', opacity, color, fontSize } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_watermarked.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.watermarkPdf(sourcePath, targetPath, text, { opacity, color, fontSize });

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Watermark PDF', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'Watermark applied successfully.',
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Add Page Numbers
exports.addPageNumbers = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, position, format, fontSize, color } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_numbered.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.addPageNumbers(sourcePath, targetPath, { position, format, fontSize, color });

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Page Numbers', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'Page numbers added successfully.',
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Protect PDF with Password & Optional Permissions
exports.protectPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, password, confirmPassword, allowPrint, allowCopy, allowEdit } = req.body;

        if (!password || typeof password !== 'string' || !password.trim()) {
            return res.status(400).json({ error: 'Password cannot be empty.' });
        }

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ error: 'Password confirmation does not match.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_protected.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.protectPdf(sourcePath, targetPath, password, {
            allowPrint: allowPrint !== false,
            allowCopy: allowCopy !== false,
            allowEdit: allowEdit === true
        });

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Protect PDF', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'PDF protected successfully with password.',
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Annotate PDF (Highlights, Text Notes, Shapes)
exports.annotatePdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, annotations } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_annotated.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.annotatePdf(sourcePath, targetPath, annotations || []);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Annotate PDF', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'Annotations saved successfully.',
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Redact PDF
exports.redactPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, redacts } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_redacted.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.redactPdf(sourcePath, targetPath, redacts || []);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Redact PDF', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'Redactions applied successfully.',
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Sign PDF
exports.signPdf = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, signatureData } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_signed.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.signPdf(sourcePath, targetPath, signatureData || {});

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Sign PDF', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'PDF signed successfully.',
            result: { id: createdFile.id, originalName: newOriginalName, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Convert to PDF/A
exports.pdfToPdfA = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId } = req.body;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_pdfa.pdf`;
        const newStoredName = `${crypto.randomUUID()}.pdf`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const result = await documentService.pdfToPdfA(sourcePath, targetPath);

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', result.size, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(result.size, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'PDF → PDF/A', file.file_size, result.size, downloadUrl);

        return res.status(201).json({
            message: 'PDF converted to PDF/A archival standard successfully.',
            result: { id: createdFile.id, originalName: newOriginalName, conformance: result.conformance, fileSize: result.size, downloadUrl }
        });
    } catch (err) {
        next(err);
    }
};

// Compare PDFs
exports.comparePdfs = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId1, fileId2 } = req.body;

        if (!fileId1 || !fileId2) return res.status(400).json({ error: 'Two PDF file IDs are required to compare.' });

        const f1 = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId1, userId);
        const f2 = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId2, userId);
        if (!f1 || !f2) return res.status(404).json({ error: 'One or both PDF files not found.' });

        const path1 = path.resolve(path.normalize(f1.storage_path));
        const path2 = path.resolve(path.normalize(f2.storage_path));

        const comparison = await documentService.comparePdfs(path1, path2);

        return res.json({
            message: 'PDF comparison complete.',
            file1: f1.original_name,
            file2: f2.original_name,
            result: comparison
        });
    } catch (err) {
        next(err);
    }
};
