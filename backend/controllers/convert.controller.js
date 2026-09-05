const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const docx = require('docx');
const xlsx = require('xlsx');
const { PDFDocument: PDFLib } = require('pdf-lib');
const assistantService = require('../services/assistant.service');
const compressionService = require('../services/compression.service');
const imageService = require('../services/image.service');
const mediaService = require('../services/media.service');
const documentService = require('../services/document.service');
const pptxService = require('../services/pptx.service');
const wordToPdfService = require('../services/wordToPdf.service');
const { getAvailableConversions, isConversionSupported, FORMAT_METADATA } = require('../services/conversionRegistry');

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
        console.warn('Failed to record transformation history:', e);
    }
}

/**
 * Get available conversion formats for a specific file
 */
exports.getFileFormats = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.fileId;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const ext = path.extname(file.original_name).toLowerCase().replace(/^\./, '');
        const conversionData = getAvailableConversions(ext);

        return res.json({
            file: {
                id: file.id,
                name: file.original_name,
                size: file.file_size,
                mimeType: file.mime_type,
                type: file.file_type
            },
            ...conversionData
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Convert Image Endpoint
 */
exports.convertImage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, format, quality } = req.body;

        if (!fileId || !format) return res.status(400).json({ error: 'File ID and target format are required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const result = await exports.convertImageDirect(userId, file, format, quality);
        return res.status(201).json({
            message: 'Image converted successfully.',
            result
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Convert Document Endpoint
 */
exports.convertDocument = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, format, quality } = req.body;

        if (!fileId || !format) return res.status(400).json({ error: 'File ID and target format are required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        // Dispatch based on file category
        let result;
        if (file.mime_type.startsWith('image/')) {
            result = await exports.convertImageDirect(userId, file, format, quality);
        } else if (file.mime_type.startsWith('video/')) {
            if (['mp3', 'wav', 'aac', 'ogg'].includes(format.toLowerCase())) {
                result = await exports.extractAudioDirect(userId, file, format);
            } else {
                result = await exports.convertVideoDirect(userId, file, format);
            }
        } else if (file.mime_type.startsWith('audio/')) {
            result = await exports.convertAudioDirect(userId, file, format);
        } else {
            result = await exports.convertDocumentDirect(userId, file, format);
        }

        return res.status(201).json({
            message: 'File converted successfully.',
            result
        });
    } catch (err) {
        return res.status(400).json({ error: err.message || 'File conversion failed.' });
    }
};

/**
 * Multiple Output Formats: Export ONE file to MULTIPLE formats simultaneously
 */
exports.multiExport = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, formats, createZip } = req.body;

        if (!fileId) return res.status(400).json({ error: 'File ID is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const ext = path.extname(file.original_name).toLowerCase().replace(/^\./, '');
        const available = getAvailableConversions(ext);
        const targetFormats = formats && Array.isArray(formats) && formats.length > 0
            ? formats.map(f => f.toLowerCase().trim())
            : available.targetFormats;

        if (targetFormats.length === 0) {
            return res.status(400).json({ error: 'No supported target formats found for this file.' });
        }

        const generatedFiles = [];
        const errors = [];

        for (const fmt of targetFormats) {
            try {
                let converted;
                if (file.mime_type.startsWith('image/')) {
                    converted = await exports.convertImageDirect(userId, file, fmt);
                } else if (file.mime_type.startsWith('video/')) {
                    if (['mp3', 'wav', 'aac'].includes(fmt)) {
                        converted = await exports.extractAudioDirect(userId, file, fmt);
                    } else {
                        converted = await exports.convertVideoDirect(userId, file, fmt);
                    }
                } else if (file.mime_type.startsWith('audio/')) {
                    converted = await exports.convertAudioDirect(userId, file, fmt);
                } else {
                    converted = await exports.convertDocumentDirect(userId, file, fmt);
                }
                generatedFiles.push(converted);
            } catch(e) {
                errors.push({ format: fmt, error: e.message });
            }
        }

        let zipResult = null;
        if (createZip !== false && generatedFiles.length > 1) {
            // Bundle all into a ZIP
            const userCompressedDir = path.join(storageRoot, 'compressed', String(userId));
            ensureDir(userCompressedDir);
            const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
            const zipOriginalName = `${baseName}_multi_export.zip`;
            const zipStoredName = `${crypto.randomUUID()}.zip`;
            const zipPath = path.join(userCompressedDir, zipStoredName);

            const fileRecords = generatedFiles.map(g => db.prepare('SELECT * FROM files WHERE id = ?').get(g.id)).filter(Boolean);
            const zipStats = await compressionService.compressFiles(fileRecords, zipPath, 'zip', { level: 9 });

            const zipFileResult = db.prepare(`
                INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userId, zipOriginalName, zipStoredName, 'archive', 'application/zip', zipStats.compressedSize, zipPath);

            db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(zipStats.compressedSize, userId);
            const createdZip = db.prepare('SELECT * FROM files WHERE id = ?').get(zipFileResult.lastInsertRowid);

            zipResult = {
                id: createdZip.id,
                originalName: zipOriginalName,
                fileSize: zipStats.compressedSize,
                downloadUrl: `/api/files/${createdZip.id}/download`
            };
        }

        return res.status(201).json({
            message: `Exported into ${generatedFiles.length} formats successfully.`,
            totalRequested: targetFormats.length,
            generatedFiles,
            zipResult,
            errors
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Universal Smart "Make It Smaller"
 */
exports.smartCompress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, targetSizeBytes, qualityPreset } = req.body;

        if (!fileId) return res.status(400).json({ error: 'File ID is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'compressed', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        let newOriginalName;
        let newStoredName;
        let targetPath;
        let fileType = file.file_type;
        let mimeType = file.mime_type;

        if (file.mime_type.startsWith('image/')) {
            newOriginalName = `${baseName}_smaller.webp`;
            newStoredName = `${crypto.randomUUID()}.webp`;
            targetPath = path.join(userConvertedDir, newStoredName);
            fileType = 'image';
            mimeType = 'image/webp';

            if (targetSizeBytes) {
                await imageService.compressImage(sourcePath, targetPath, { targetSizeBytes });
            } else {
                await sharp(sourcePath).webp({ quality: 75, effort: 6 }).toFile(targetPath);
            }
        } else if (file.mime_type.startsWith('video/')) {
            newOriginalName = `${baseName}_smaller.mp4`;
            newStoredName = `${crypto.randomUUID()}.mp4`;
            targetPath = path.join(userConvertedDir, newStoredName);
            fileType = 'video';
            mimeType = 'video/mp4';

            await mediaService.compressVideo(sourcePath, targetPath, {
                quality: qualityPreset || 'medium',
                targetSizeBytes
            });
        } else if (file.mime_type.startsWith('audio/')) {
            newOriginalName = `${baseName}_smaller.mp3`;
            newStoredName = `${crypto.randomUUID()}.mp3`;
            targetPath = path.join(userConvertedDir, newStoredName);
            fileType = 'audio';
            mimeType = 'audio/mpeg';

            await mediaService.compressAudio(sourcePath, targetPath, { bitrate: '128k' });
        } else {
            // PDF or Document -> ZIP archive compression
            newOriginalName = `${baseName}_smaller.zip`;
            newStoredName = `${crypto.randomUUID()}.zip`;
            targetPath = path.join(userConvertedDir, newStoredName);
            fileType = 'archive';
            mimeType = 'application/zip';

            await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
        }

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, fileType, mimeType, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, 'Make It Smaller', file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: 'File optimized successfully.',
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
 * Batch Multi-File Conversion
 */
exports.batchConvert = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileIds, targetFormat, format, quality, combinePdf, bundleZip } = req.body;
        const effectiveFormat = (targetFormat || format || '').toLowerCase().trim();

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0 || !effectiveFormat) {
            return res.status(400).json({ error: 'Array of file IDs and target format are required.' });
        }

        // If combining all images to single PDF
        if (combinePdf && effectiveFormat === 'pdf') {
            const placeholders = fileIds.map(() => '?').join(',');
            const files = db.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ? AND status = "active"`).all(...fileIds, userId);
            const imagePaths = files.map(f => path.resolve(path.normalize(f.storage_path)));

            const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
            ensureDir(userConvertedDir);
            const newOriginalName = `batch_combined_${Date.now()}.pdf`;
            const newStoredName = `${crypto.randomUUID()}.pdf`;
            const targetPath = path.join(userConvertedDir, newStoredName);

            const pdfRes = await imageService.imagesToPdf(imagePaths, targetPath);

            const totalOriginalSize = files.reduce((acc, f) => acc + f.file_size, 0);
            const fileResult = db.prepare(`
                INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userId, newOriginalName, newStoredName, 'doc', 'application/pdf', pdfRes.size, targetPath);

            db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(pdfRes.size, userId);
            const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
            const downloadUrl = `/api/files/${createdFile.id}/download`;

            recordTransformation(userId, `${files.length} Files`, newOriginalName, 'Batch → Combined PDF', totalOriginalSize, pdfRes.size, downloadUrl);

            return res.status(201).json({
                message: `Combined ${files.length} files into single PDF.`,
                total: files.length,
                successful: [{
                    fileId: createdFile.id,
                    originalName: newOriginalName,
                    result: { id: createdFile.id, originalName: newOriginalName, convertedSize: pdfRes.size, downloadUrl }
                }],
                failed: [],
                results: [{ id: createdFile.id, originalName: newOriginalName, convertedSize: pdfRes.size, downloadUrl }]
            });
        }

        const placeholders = fileIds.map(() => '?').join(',');
        const files = db.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ? AND status = "active"`).all(...fileIds, userId);

        const successful = [];
        const failed = [];
        const convertedFileRecords = [];

        for (const file of files) {
            try {
                let singleRes;
                if (file.mime_type.startsWith('image/')) {
                    singleRes = await exports.convertImageDirect(userId, file, effectiveFormat, quality);
                } else if (file.mime_type.startsWith('video/')) {
                    if (['mp3', 'wav', 'aac', 'ogg'].includes(effectiveFormat)) {
                        singleRes = await exports.extractAudioDirect(userId, file, effectiveFormat);
                    } else {
                        singleRes = await exports.convertVideoDirect(userId, file, effectiveFormat);
                    }
                } else if (file.mime_type.startsWith('audio/')) {
                    singleRes = await exports.convertAudioDirect(userId, file, effectiveFormat);
                } else {
                    singleRes = await exports.convertDocumentDirect(userId, file, effectiveFormat);
                }

                successful.push({
                    fileId: file.id,
                    originalName: file.original_name,
                    result: singleRes
                });
                const rec = db.prepare('SELECT * FROM files WHERE id = ?').get(singleRes.id);
                if (rec) convertedFileRecords.push(rec);
            } catch (e) {
                failed.push({
                    fileId: file.id,
                    originalName: file.original_name,
                    error: e.message || 'Conversion failed'
                });
            }
        }

        // Check for files requested but missing from active database
        for (const reqId of fileIds) {
            if (!files.some(f => String(f.id) === String(reqId))) {
                failed.push({
                    fileId: reqId,
                    originalName: `File ID ${reqId}`,
                    error: 'File not found in workspace'
                });
            }
        }

        // Create a ZIP bundle for easy single download if multiple files succeeded or bundleZip requested
        let zipResult = null;
        if (convertedFileRecords.length > 1 || (bundleZip && convertedFileRecords.length > 0)) {
            try {
                const userCompressedDir = path.join(storageRoot, 'compressed', String(userId));
                ensureDir(userCompressedDir);
                const zipOriginalName = `batch_converted_${effectiveFormat.toUpperCase()}_${Date.now()}.zip`;
                const zipStoredName = `${crypto.randomUUID()}.zip`;
                const zipPath = path.join(userCompressedDir, zipStoredName);

                const zipStats = await compressionService.compressFiles(convertedFileRecords, zipPath, 'zip', { level: 9 });

                const zipFileResult = db.prepare(`
                    INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(userId, zipOriginalName, zipStoredName, 'archive', 'application/zip', zipStats.compressedSize, zipPath);

                db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(zipStats.compressedSize, userId);
                const createdZip = db.prepare('SELECT * FROM files WHERE id = ?').get(zipFileResult.lastInsertRowid);

                zipResult = {
                    id: createdZip.id,
                    originalName: zipOriginalName,
                    fileSize: zipStats.compressedSize,
                    downloadUrl: `/api/files/${createdZip.id}/download`
                };
            } catch (zipErr) {
                console.warn('Failed to generate batch zip archive:', zipErr);
            }
        }

        return res.status(200).json({
            message: `Batch conversion complete: ${successful.length} succeeded, ${failed.length} failed.`,
            total: fileIds.length,
            successful,
            failed,
            results: successful.map(s => s.result),
            zipResult
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Conversational Assistant Query
 */
exports.assistantQuery = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { query, fileId, fileIds } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Please enter a natural language command for Docholder Assistant.' });
        }

        const parsed = assistantService.parseIntent(query);
        let selectedFile = null;
        if (fileId) {
            selectedFile = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        }

        let reply = '';
        let resultData = null;

        if (parsed.intent === 'prepare' && parsed.preparePreset) {
            if (!selectedFile) {
                return res.json({
                    reply: `I can optimize your file for **${parsed.preparePreset.toUpperCase()}**. Please select or attach your file!`,
                    intent: parsed.intent,
                    needsFile: true
                });
            }

            reply = `Optimizing **${selectedFile.original_name}** for **${parsed.preparePreset.toUpperCase()}**...`;
            const prepReq = { user: { id: userId }, body: { fileId: selectedFile.id, preset: parsed.preparePreset } };
            const prepRes = await new Promise((resolve, reject) => {
                exports.prepareFile(prepReq, {
                    status: () => ({ json: (d) => resolve(d.result) }),
                    json: (d) => resolve(d.result)
                }, reject);
            });
            resultData = prepRes;
            reply = `Done! Prepared **${selectedFile.original_name}** for **${parsed.preparePreset.toUpperCase()}** (${resultData.percentageSaved}% saved).`;
        } else if (parsed.intent === 'extract_audio') {
            if (!selectedFile) {
                return res.json({
                    reply: `I detected an **Audio Extraction** request. Please select or attach your video file first!`,
                    intent: parsed.intent,
                    needsFile: true
                });
            }

            const targetAudioFormat = parsed.targetFormat || 'mp3';
            reply = `Extracting ${targetAudioFormat.toUpperCase()} audio from **${selectedFile.original_name}**...`;
            resultData = await exports.extractAudioDirect(userId, selectedFile, targetAudioFormat);
            reply = `Done! Extracted audio into **${resultData.originalName}** (${formatBytes(resultData.convertedSize)}).`;
        } else if (parsed.intent === 'multi_convert' && parsed.matchedFormats && parsed.matchedFormats.length > 0) {
            if (!selectedFile) {
                return res.json({
                    reply: `I can export your file to **${parsed.matchedFormats.map(f=>f.toUpperCase()).join(', ')}**. Please attach your file!`,
                    intent: parsed.intent,
                    needsFile: true
                });
            }

            reply = `Exporting **${selectedFile.original_name}** to multiple formats...`;
            const exportReq = { user: { id: userId }, body: { fileId: selectedFile.id, formats: parsed.matchedFormats, createZip: true } };
            const multiRes = await new Promise((resolve, reject) => {
                exports.multiExport(exportReq, {
                    status: () => ({ json: resolve }),
                    json: resolve
                }, reject);
            });
            resultData = multiRes;
            reply = `Done! Converted **${selectedFile.original_name}** into ${multiRes.generatedFiles.length} formats with an optional ZIP bundle.`;
        } else if (parsed.intent === 'convert' && parsed.targetFormat) {
            if (!selectedFile) {
                return res.json({
                    reply: `I can convert your file to **${parsed.targetFormat.toUpperCase()}**. Please select or upload a file first!`,
                    intent: parsed.intent,
                    needsFile: true
                });
            }

            reply = `Converting **${selectedFile.original_name}** to **${parsed.targetFormat.toUpperCase()}**...`;
            if (selectedFile.mime_type.startsWith('image/')) {
                resultData = await exports.convertImageDirect(userId, selectedFile, parsed.targetFormat);
            } else if (selectedFile.mime_type.startsWith('video/')) {
                if (['mp3', 'wav', 'aac'].includes(parsed.targetFormat)) {
                    resultData = await exports.extractAudioDirect(userId, selectedFile, parsed.targetFormat);
                } else {
                    resultData = await exports.convertVideoDirect(userId, selectedFile, parsed.targetFormat);
                }
            } else if (selectedFile.mime_type.startsWith('audio/')) {
                resultData = await exports.convertAudioDirect(userId, selectedFile, parsed.targetFormat);
            } else {
                resultData = await exports.convertDocumentDirect(userId, selectedFile, parsed.targetFormat);
            }
            reply = `Done! Converted **${selectedFile.original_name}** into **${resultData.originalName}**.`;
        } else if (parsed.intent === 'target_size' && parsed.targetSize) {
            if (!selectedFile) {
                return res.json({
                    reply: `I can optimize your file to under **${formatBytes(parsed.targetSize)}**. Please select a file!`,
                    intent: parsed.intent,
                    needsFile: true
                });
            }

            reply = `Optimizing **${selectedFile.original_name}** below **${formatBytes(parsed.targetSize)}**...`;
            const optReq = { user: { id: userId }, body: { fileId: selectedFile.id, targetSizeBytes: parsed.targetSize } };
            const optRes = await new Promise((resolve, reject) => {
                exports.smartCompress(optReq, { status: () => ({ json: (d) => resolve(d.result) }), json: (d) => resolve(d.result) }, reject);
            });
            resultData = optRes;
            reply = `Done! Reduced from ${formatBytes(selectedFile.file_size)} to **${formatBytes(resultData.convertedSize)}** (${resultData.percentageSaved}% saved).`;
        } else if (parsed.intent === 'compress' || parsed.action === 'optimize') {
            if (!selectedFile && (!fileIds || fileIds.length === 0)) {
                return res.json({
                    reply: `I'll compress your files for maximum space savings. Please select the file(s) you want to compress.`,
                    intent: parsed.intent,
                    needsFile: true
                });
            }

            const targetFiles = fileIds && fileIds.length > 0 
                ? db.prepare(`SELECT * FROM files WHERE id IN (${fileIds.map(()=>'?').join(',')}) AND user_id = ? AND status = "active"`).all(...fileIds, userId)
                : [selectedFile];

            if (targetFiles.length === 1) {
                const optReq = { user: { id: userId }, body: { fileId: targetFiles[0].id } };
                const optRes = await new Promise((resolve, reject) => {
                    exports.smartCompress(optReq, { status: () => ({ json: (d) => resolve(d.result) }), json: (d) => resolve(d.result) }, reject);
                });
                resultData = optRes;
                reply = `Done! Optimized **${targetFiles[0].original_name}** (${resultData.percentageSaved}% saved).`;
            } else {
                const userCompressedDir = path.join(storageRoot, 'compressed', String(userId));
                ensureDir(userCompressedDir);
                const archiveStoredName = `${crypto.randomUUID()}.zip`;
                const archiveOriginalName = `archive_${Date.now()}.zip`;
                const outputPath = path.join(userCompressedDir, archiveStoredName);

                const stats = await compressionService.compressFiles(targetFiles, outputPath, 'zip', { level: 9 });

                const fileResult = db.prepare(`
                    INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(userId, archiveOriginalName, archiveStoredName, 'archive', 'application/zip', stats.compressedSize, outputPath);

                db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(stats.compressedSize, userId);
                const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
                const downloadUrl = `/api/files/${createdFile.id}/download`;

                recordTransformation(userId, targetFiles.map(f=>f.original_name).join(', '), archiveOriginalName, 'Compress ZIP', stats.originalSize, stats.compressedSize, downloadUrl);

                resultData = {
                    id: createdFile.id,
                    originalName: archiveOriginalName,
                    originalSize: stats.originalSize,
                    convertedSize: stats.compressedSize,
                    percentageSaved: stats.percentageSaved,
                    downloadUrl
                };
                reply = `Done! Compressed ${targetFiles.length} files into **${archiveOriginalName}** (${stats.percentageSaved}% saved).`;
            }
        } else {
            reply = `I'm Docholder Assistant! You can ask me to:
• "Convert this video to MP3"
• "Compress this image below 500KB"
• "Convert this PDF to Word and JPG"
• "Extract audio from this MP4"
• "Make this video smaller"
• "Convert these documents to PDF"`;
        }

        return res.json({
            reply,
            intent: parsed.intent,
            action: parsed.action,
            pipelineSteps: parsed.pipelineSteps,
            result: resultData
        });
    } catch (err) {
        return res.status(400).json({ error: err.message || 'Docholder Assistant encountered an error.' });
    }
};

// Target Size Mode (Backward compatibility)
exports.targetSizeOptimization = async (req, res, next) => {
    return exports.smartCompress(req, res, next);
};

// Optimize File (Backward compatibility)
exports.optimizeFile = async (req, res, next) => {
    return exports.smartCompress(req, res, next);
};

// Prepare File
exports.prepareFile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, preset } = req.body;

        if (!fileId || !preset) {
            return res.status(400).json({ error: 'File ID and preset (twitter, discord, threads, instagram, tiktok, youtube, linkedin, email, whatsapp, website, printing, cloud) are required.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        ensureDir(userConvertedDir);

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        let newOriginalName = `${baseName}_prepared_${preset}`;
        let newStoredName;
        let targetPath;
        let mimeType = file.mime_type;
        let fileType = file.file_type;
        const normPreset = (preset || '').toLowerCase();

        if (normPreset === 'twitter' || normPreset === 'x') {
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.jpg';
                newStoredName = `${crypto.randomUUID()}.jpg`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/jpeg';
                await sharp(sourcePath).resize(1200, 675, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toFile(targetPath);
            } else if (file.mime_type.startsWith('video/')) {
                newOriginalName += '.mp4';
                newStoredName = `${crypto.randomUUID()}.mp4`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'video/mp4';
                await mediaService.compressVideo(sourcePath, targetPath, { resolution: '720p', quality: 'medium' });
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'discord') {
            const targetDiscordLimit = 9.5 * 1024 * 1024; // 9.5MB safe limit for free Discord users
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.webp';
                newStoredName = `${crypto.randomUUID()}.webp`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/webp';
                await imageService.compressImage(sourcePath, targetPath, { targetSizeBytes: targetDiscordLimit, quality: 80 });
            } else if (file.mime_type.startsWith('video/')) {
                newOriginalName += '.mp4';
                newStoredName = `${crypto.randomUUID()}.mp4`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'video/mp4';
                await mediaService.compressVideo(sourcePath, targetPath, { targetSizeBytes: targetDiscordLimit, resolution: '720p' });
            } else if (file.mime_type.startsWith('audio/')) {
                newOriginalName += '.mp3';
                newStoredName = `${crypto.randomUUID()}.mp3`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'audio/mpeg';
                await mediaService.compressAudio(sourcePath, targetPath, { bitrate: '128k' });
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'threads' || normPreset === 'instagram') {
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.jpg';
                newStoredName = `${crypto.randomUUID()}.jpg`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/jpeg';
                await sharp(sourcePath).resize(1080, 1080, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toFile(targetPath);
            } else if (file.mime_type.startsWith('video/')) {
                newOriginalName += '.mp4';
                newStoredName = `${crypto.randomUUID()}.mp4`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'video/mp4';
                await mediaService.compressVideo(sourcePath, targetPath, { resolution: '1080p', quality: 'high' });
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'tiktok') {
            if (file.mime_type.startsWith('video/')) {
                newOriginalName += '.mp4';
                newStoredName = `${crypto.randomUUID()}.mp4`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'video/mp4';
                await mediaService.compressVideo(sourcePath, targetPath, { resolution: '720:1280', quality: 'high', fps: 30 });
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'youtube') {
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.jpg';
                newStoredName = `${crypto.randomUUID()}.jpg`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/jpeg';
                await sharp(sourcePath).resize(1280, 720, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toFile(targetPath);
            } else if (file.mime_type.startsWith('video/')) {
                newOriginalName += '.mp4';
                newStoredName = `${crypto.randomUUID()}.mp4`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'video/mp4';
                await mediaService.compressVideo(sourcePath, targetPath, { resolution: '1080p', quality: 'high' });
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'linkedin') {
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.jpg';
                newStoredName = `${crypto.randomUUID()}.jpg`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/jpeg';
                await sharp(sourcePath).resize(1200, 627, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toFile(targetPath);
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'email') {
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.jpg';
                newStoredName = `${crypto.randomUUID()}.jpg`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/jpeg';
                await sharp(sourcePath).resize(1920, 1920, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(targetPath);
            } else if (file.mime_type.startsWith('video/')) {
                newOriginalName += '.mp4';
                newStoredName = `${crypto.randomUUID()}.mp4`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'video/mp4';
                await mediaService.compressVideo(sourcePath, targetPath, { resolution: '720p', quality: 'medium' });
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else if (normPreset === 'whatsapp') {
            if (file.mime_type.startsWith('image/')) {
                newOriginalName += '.webp';
                newStoredName = `${crypto.randomUUID()}.webp`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'image/webp';
                await sharp(sourcePath).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(targetPath);
            } else {
                newOriginalName += '.zip';
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        } else {
            newOriginalName += '.webp';
            newStoredName = `${crypto.randomUUID()}.webp`;
            targetPath = path.join(userConvertedDir, newStoredName);
            mimeType = 'image/webp';
            if (file.mime_type.startsWith('image/')) {
                await sharp(sourcePath).webp({ quality: 80 }).toFile(targetPath);
            } else {
                newOriginalName = `${baseName}_prepared_${preset}.zip`;
                newStoredName = `${crypto.randomUUID()}.zip`;
                targetPath = path.join(userConvertedDir, newStoredName);
                mimeType = 'application/zip';
                fileType = 'archive';
                await compressionService.compressFiles([file], targetPath, 'zip', { level: 9 });
            }
        }

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, fileType, mimeType, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        recordTransformation(userId, file.original_name, newOriginalName, `Prepared for ${preset.toUpperCase()}`, file.file_size, newSize, downloadUrl);

        return res.status(201).json({
            message: `File prepared for ${preset}.`,
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

// History endpoints
exports.getTransformationHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const history = db.prepare('SELECT * FROM transformations WHERE user_id = ?').all(userId);
        return res.json({ history });
    } catch (err) {
        next(err);
    }
};

exports.deleteTransformationHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        db.prepare('DELETE FROM transformations WHERE id = ?').run(id, userId);
        return res.json({ message: 'History record deleted.' });
    } catch (err) {
        next(err);
    }
};

exports.clearTransformationHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        db.prepare('DELETE FROM transformations WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM compression_history WHERE user_id = ?').run(userId);
        return res.json({ message: 'All transformation history cleared.' });
    } catch (err) {
        next(err);
    }
};

// Direct Execution Helpers
exports.convertImageDirect = async (userId, file, format, quality = 85) => {
    const normFormat = format.toLowerCase() === 'jpg' ? 'jpeg' : format.toLowerCase();
    const sourcePath = path.resolve(path.normalize(file.storage_path));
    const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
    ensureDir(userConvertedDir);

    const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
    const outExt = normFormat === 'jpeg' ? 'jpg' : normFormat;
    const newOriginalName = `${baseName}.${outExt}`;
    const newStoredName = `${crypto.randomUUID()}.${outExt}`;
    const targetPath = path.join(userConvertedDir, newStoredName);

    await imageService.convertImage(sourcePath, targetPath, normFormat, { quality });

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
    return {
        id: createdFile.id,
        originalName: newOriginalName,
        originalSize: file.file_size,
        convertedSize: newSize,
        percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
        downloadUrl
    };
};

exports.convertDocumentDirect = async (userId, file, targetFormat, options = {}) => {
    const sourcePath = path.resolve(path.normalize(file.storage_path));
    const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
    ensureDir(userConvertedDir);

    const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
    const normFormat = targetFormat.toLowerCase();
    const newOriginalName = `${baseName}.${normFormat}`;
    const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
    const targetPath = path.join(userConvertedDir, newStoredName);
    const sourceExt = file.original_name.split('.').pop().toLowerCase();

    let mimeType = 'application/octet-stream';
    let fileType = 'doc';

    if (sourceExt === 'pdf') {
        if (normFormat === 'docx') {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            const lines = (data.text || '').split('\n');
            const paragraphs = lines.map(line => new docx.Paragraph({
                children: [new docx.TextRun({ text: line.trim() || ' ', size: 24, font: 'Calibri' })]
            }));
            const docxDoc = new docx.Document({ sections: [{ children: paragraphs }] });
            fs.writeFileSync(targetPath, await docx.Packer.toBuffer(docxDoc));
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (normFormat === 'txt') {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            fs.writeFileSync(targetPath, data.text || '');
            mimeType = 'text/plain';
            fileType = 'text';
        } else if (normFormat === 'html') {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            const escaped = (data.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            fs.writeFileSync(targetPath, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${file.original_name}</title></head><body>${escaped}</body></html>`);
            mimeType = 'text/html';
            fileType = 'text';
        } else if (normFormat === 'md') {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            fs.writeFileSync(targetPath, `# ${baseName}\n\n${data.text || ''}`);
            mimeType = 'text/markdown';
            fileType = 'text';
        } else if (normFormat === 'pdfa') {
            await documentService.pdfToPdfA(sourcePath, targetPath);
            mimeType = 'application/pdf';
        } else if (normFormat === 'xlsx') {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            const lines = (data.text || '').split('\n').filter(Boolean);
            const ws = xlsx.utils.aoa_to_sheet(lines.map(l => [l]));
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
            xlsx.writeFile(wb, targetPath);
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (normFormat === 'pptx') {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            await pptxService.textToPptx(data.text || baseName, baseName, targetPath);
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (['png', 'jpg', 'jpeg'].includes(normFormat)) {
            const dataBuffer = fs.readFileSync(sourcePath);
            const data = await pdfParse(dataBuffer);
            const text = (data.text || '').substring(0, 800).trim() || baseName;
            const safeBase = baseName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1300" viewBox="0 0 1000 1300">
              <rect width="100%" height="100%" fill="#F8FAFC"/>
              <rect x="25" y="25" width="950" height="1250" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
              <text x="60" y="90" font-family="sans-serif" font-size="28" font-weight="bold" fill="#0F172A">${safeBase}</text>
              <line x1="60" y1="115" x2="940" y2="115" stroke="#6366F1" stroke-width="3"/>
              <foreignObject x="60" y="140" width="880" height="1080">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;font-size:18px;line-height:1.6;color:#334155;white-space:pre-wrap;">${safeText}</div>
              </foreignObject>
            </svg>`;
            if (normFormat === 'png') {
                await sharp(Buffer.from(svg)).png().toFile(targetPath);
                mimeType = 'image/png';
            } else {
                await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(targetPath);
                mimeType = 'image/jpeg';
            }
            fileType = 'image';
        }
    } else if (sourceExt === 'docx' || sourceExt === 'doc') {
        if (normFormat === 'pdf') {
            await wordToPdfService.convertWordToPdf(sourcePath, targetPath, baseName, options);
            mimeType = 'application/pdf';
            fileType = 'doc';
        } else if (normFormat === 'pptx') {
            const result = await mammoth.extractRawText({ path: sourcePath });
            await pptxService.textToPptx(result.value || baseName, baseName, targetPath);
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (normFormat === 'txt') {
            const result = await mammoth.extractRawText({ path: sourcePath });
            fs.writeFileSync(targetPath, result.value || '');
            mimeType = 'text/plain';
            fileType = 'text';
        } else if (normFormat === 'html') {
            const result = await mammoth.convertToHtml({ path: sourcePath });
            fs.writeFileSync(targetPath, result.value || '');
            mimeType = 'text/html';
            fileType = 'text';
        } else if (normFormat === 'md') {
            const result = await mammoth.extractRawText({ path: sourcePath });
            fs.writeFileSync(targetPath, `# ${baseName}\n\n${result.value || ''}`);
            mimeType = 'text/markdown';
            fileType = 'text';
        }
    } else if (sourceExt === 'pptx' || sourceExt === 'ppt') {
        if (normFormat === 'pdf') {
            await pptxService.pptxToPdf(sourcePath, targetPath);
            mimeType = 'application/pdf';
            fileType = 'doc';
        } else if (normFormat === 'txt') {
            const slides = pptxService.extractPptxText(sourcePath);
            const content = slides.map(s => `--- ${s.title} ---\n${s.content}`).join('\n\n');
            fs.writeFileSync(targetPath, content);
            mimeType = 'text/plain';
            fileType = 'text';
        }
    } else if (sourceExt === 'xlsx' || sourceExt === 'xls') {
        const workbook = xlsx.readFile(sourcePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (normFormat === 'csv') {
            fs.writeFileSync(targetPath, xlsx.utils.sheet_to_csv(sheet));
            mimeType = 'text/csv';
            fileType = 'text';
        } else if (normFormat === 'json') {
            fs.writeFileSync(targetPath, JSON.stringify(xlsx.utils.sheet_to_json(sheet), null, 2));
            mimeType = 'application/json';
            fileType = 'text';
        } else if (normFormat === 'pdf') {
            const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
            const stream = fs.createWriteStream(targetPath);
            doc.pipe(stream);
            doc.fontSize(14).font('Helvetica-Bold').text(baseName, { align: 'left' });
            doc.moveDown(1);
            doc.fontSize(9).font('Helvetica');
            jsonData.slice(0, 60).forEach(row => doc.text(row.join('  |  ')));
            doc.end();
            await new Promise(resolve => stream.on('finish', resolve));
            mimeType = 'application/pdf';
        }
    } else if (sourceExt === 'csv') {
        const content = fs.readFileSync(sourcePath, 'utf8');
        if (normFormat === 'xlsx') {
            const wb = xlsx.read(content, { type: 'string' });
            xlsx.writeFile(wb, targetPath);
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (normFormat === 'json') {
            const wb = xlsx.read(content, { type: 'string' });
            const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
            mimeType = 'application/json';
            fileType = 'text';
        } else if (normFormat === 'pdf') {
            const doc = new PDFDocument({ margin: 40 });
            const stream = fs.createWriteStream(targetPath);
            doc.pipe(stream);
            doc.fontSize(14).font('Helvetica-Bold').text(baseName, { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(9).font('Courier').text(content);
            doc.end();
            await new Promise(resolve => stream.on('finish', resolve));
            mimeType = 'application/pdf';
        }
    } else if (sourceExt === 'txt' || sourceExt === 'md') {
        const text = fs.readFileSync(sourcePath, 'utf8');
        if (normFormat === 'pdf') {
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(targetPath);
            doc.pipe(stream);
            doc.fontSize(16).font('Helvetica-Bold').text(baseName, { align: 'center' });
            doc.moveDown(1.5);
            doc.fontSize(10).font('Helvetica').lineGap(3).text(text);
            doc.end();
            await new Promise(resolve => stream.on('finish', resolve));
            mimeType = 'application/pdf';
        } else if (normFormat === 'docx') {
            const docxDoc = new docx.Document({
                sections: [{
                    children: [
                        new docx.Paragraph({ text: baseName, heading: docx.HeadingLevel.HEADING_1 }),
                        ...text.split('\n').map(line => new docx.Paragraph({ text: line }))
                    ]
                }]
            });
            fs.writeFileSync(targetPath, await docx.Packer.toBuffer(docxDoc));
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (normFormat === 'html') {
            const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            fs.writeFileSync(targetPath, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${baseName}</title></head><body><pre style="font-family:sans-serif;white-space:pre-wrap;padding:20px;">${escaped}</pre></body></html>`);
            mimeType = 'text/html';
            fileType = 'text';
        }
    }

    const newSize = fs.statSync(targetPath).size;
    const fileResult = db.prepare(`
        INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, newOriginalName, newStoredName, fileType, mimeType, newSize, targetPath);

    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
    const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
    const downloadUrl = `/api/files/${createdFile.id}/download`;

    recordTransformation(userId, file.original_name, newOriginalName, `Convert to ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);
    return {
        id: createdFile.id,
        originalName: newOriginalName,
        originalSize: file.file_size,
        convertedSize: newSize,
        percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
        downloadUrl
    };
};

exports.extractAudioDirect = async (userId, file, format = 'mp3') => {
    const sourcePath = path.resolve(path.normalize(file.storage_path));
    const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
    ensureDir(userConvertedDir);

    const normFormat = format.toLowerCase().trim();
    const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
    const newOriginalName = `${baseName}.${normFormat}`;
    const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
    const targetPath = path.join(userConvertedDir, newStoredName);

    await mediaService.extractAudio(sourcePath, targetPath, normFormat);

    const newSize = fs.statSync(targetPath).size;
    const fileResult = db.prepare(`
        INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, newOriginalName, newStoredName, 'audio', `audio/${normFormat === 'mp3' ? 'mpeg' : normFormat}`, newSize, targetPath);

    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
    const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
    const downloadUrl = `/api/files/${createdFile.id}/download`;

    recordTransformation(userId, file.original_name, newOriginalName, `Extract ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);
    return {
        id: createdFile.id,
        originalName: newOriginalName,
        originalSize: file.file_size,
        convertedSize: newSize,
        percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
        downloadUrl
    };
};

exports.convertVideoDirect = async (userId, file, format) => {
    const sourcePath = path.resolve(path.normalize(file.storage_path));
    const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
    ensureDir(userConvertedDir);

    const normFormat = format.toLowerCase().trim();
    const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
    const newOriginalName = `${baseName}.${normFormat}`;
    const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
    const targetPath = path.join(userConvertedDir, newStoredName);

    await mediaService.convertVideo(sourcePath, targetPath, normFormat);

    const newSize = fs.statSync(targetPath).size;
    const mimeType = normFormat === 'gif' ? 'image/gif' : `video/${normFormat}`;
    const fileResult = db.prepare(`
        INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, newOriginalName, newStoredName, normFormat === 'gif' ? 'image' : 'video', mimeType, newSize, targetPath);

    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
    const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
    const downloadUrl = `/api/files/${createdFile.id}/download`;

    recordTransformation(userId, file.original_name, newOriginalName, `Convert to ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);
    return {
        id: createdFile.id,
        originalName: newOriginalName,
        originalSize: file.file_size,
        convertedSize: newSize,
        percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
        downloadUrl
    };
};

exports.convertAudioDirect = async (userId, file, format) => {
    const sourcePath = path.resolve(path.normalize(file.storage_path));
    const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
    ensureDir(userConvertedDir);

    const normFormat = format.toLowerCase().trim();
    const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
    const newOriginalName = `${baseName}.${normFormat}`;
    const newStoredName = `${crypto.randomUUID()}.${normFormat}`;
    const targetPath = path.join(userConvertedDir, newStoredName);

    await mediaService.convertAudio(sourcePath, targetPath, normFormat);

    const newSize = fs.statSync(targetPath).size;
    const fileResult = db.prepare(`
        INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, newOriginalName, newStoredName, 'audio', `audio/${normFormat === 'mp3' ? 'mpeg' : normFormat}`, newSize, targetPath);

    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
    const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
    const downloadUrl = `/api/files/${createdFile.id}/download`;

    recordTransformation(userId, file.original_name, newOriginalName, `Convert to ${normFormat.toUpperCase()}`, file.file_size, newSize, downloadUrl);
    return {
        id: createdFile.id,
        originalName: newOriginalName,
        originalSize: file.file_size,
        convertedSize: newSize,
        percentageSaved: file.file_size > 0 ? Math.max(0, Math.round((1 - (newSize / file.file_size)) * 100)) : 0,
        downloadUrl
    };
};



function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

