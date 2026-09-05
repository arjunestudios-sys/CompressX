const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const db = require('../config/db');

const storageRoot = path.join(__dirname, '../storage');

exports.extractText = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        if (file.file_type !== 'doc' || (!file.mime_type.includes('msword') && !file.mime_type.includes('officedocument') && !file.original_name.endsWith('.docx'))) {
            return res.status(400).json({ error: 'Only DOCX files are supported.' });
        }

        const normalizedPath = path.normalize(file.storage_path);
        const resolvedPath = path.resolve(normalizedPath);

        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found on disk.' });
        }

        // Open DOCX as ZIP
        const zip = new AdmZip(resolvedPath);
        const docXmlEntry = zip.getEntry('word/document.xml');
        
        if (!docXmlEntry) {
            return res.status(400).json({ error: 'Invalid DOCX structure: word/document.xml missing.' });
        }

        const xmlString = docXmlEntry.getData().toString('utf8');
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        // Extract <w:t> elements
        const textNodes = doc.getElementsByTagName('w:t');
        const blocks = [];
        
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            const textContent = node.textContent;
            blocks.push({
                id: i,
                text: textContent
            });
        }

        return res.json({ blocks });
    } catch (err) {
        next(err);
    }
};

exports.updateText = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;
        const { blocks } = req.body; // Array of { id, text }

        if (!blocks || !Array.isArray(blocks)) {
            return res.status(400).json({ error: 'Blocks array is required.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const normalizedPath = path.normalize(file.storage_path);
        const resolvedPath = path.resolve(normalizedPath);

        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found on disk.' });
        }

        const oldSize = fs.statSync(resolvedPath).size;

        const zip = new AdmZip(resolvedPath);
        const docXmlEntry = zip.getEntry('word/document.xml');
        
        if (!docXmlEntry) {
            return res.status(400).json({ error: 'Invalid DOCX structure.' });
        }

        const xmlString = docXmlEntry.getData().toString('utf8');
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        
        const textNodes = doc.getElementsByTagName('w:t');

        // Apply updates
        for (const block of blocks) {
            const index = block.id;
            if (index >= 0 && index < textNodes.length) {
                const node = textNodes[index];
                
                // Clear existing child nodes (usually just a text node)
                while (node.firstChild) {
                    node.removeChild(node.firstChild);
                }
                
                // Append new text node
                const newTextNode = doc.createTextNode(block.text);
                node.appendChild(newTextNode);
            }
        }

        // Serialize back to XML
        const serializer = new XMLSerializer();
        const updatedXmlString = serializer.serializeToString(doc);

        // Update zip entry
        zip.updateFile('word/document.xml', Buffer.from(updatedXmlString, 'utf8'));

        // Save zip
        zip.writeZip(resolvedPath);

        const newSize = fs.statSync(resolvedPath).size;
        const sizeDiff = newSize - oldSize;

        db.prepare('UPDATE files SET file_size = ? WHERE id = ?').run(newSize, fileId);
        if (sizeDiff !== 0) {
            db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(sizeDiff, userId);
        }

        return res.json({ message: 'DOCX updated successfully.', newSize });
    } catch (err) {
        next(err);
    }
};

const crypto = require('crypto');
exports.removeWatermark = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id;

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });
        if (file.file_type !== 'doc' || (!file.mime_type.includes('msword') && !file.mime_type.includes('officedocument') && !file.original_name.endsWith('.docx'))) {
            return res.status(400).json({ error: 'Only DOCX files are supported.' });
        }

        const resolvedPath = path.resolve(path.normalize(file.storage_path));
        if (!fs.existsSync(resolvedPath)) return res.status(404).json({ error: 'File not found on disk.' });

        const zip = new AdmZip(resolvedPath);
        const zipEntries = zip.getEntries();
        let modified = false;

        zipEntries.forEach(entry => {
            if (entry.entryName.startsWith('word/header') && entry.entryName.endsWith('.xml')) {
                const xmlString = entry.getData().toString('utf8');
                const parser = new DOMParser();
                const doc = parser.parseFromString(xmlString, 'text/xml');
                
                // Usually watermarks are inside <v:shape> with id containing 'WaterMark' or 'PowerPlusWaterMark'
                const shapes = doc.getElementsByTagName('v:shape');
                let shapeModified = false;
                
                // Convert HTMLCollection/NodeList to array to safely remove while iterating
                const shapesArray = [];
                for (let i = 0; i < shapes.length; i++) {
                    shapesArray.push(shapes[i]);
                }
                
                shapesArray.forEach(shape => {
                    const id = shape.getAttribute('id') || '';
                    const style = shape.getAttribute('style') || '';
                    if (id.toLowerCase().includes('watermark') || style.toLowerCase().includes('rotation') || shape.toString().toLowerCase().includes('watermark')) {
                        shape.parentNode.removeChild(shape);
                        shapeModified = true;
                        modified = true;
                    }
                });

                if (shapeModified) {
                    const serializer = new XMLSerializer();
                    const updatedXmlString = serializer.serializeToString(doc);
                    zip.updateFile(entry.entryName, Buffer.from(updatedXmlString, 'utf8'));
                }
            }
        });

        if (!modified) {
            return res.status(400).json({ error: 'No watermark objects found to remove in this document.' });
        }

        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        if (!fs.existsSync(userConvertedDir)) fs.mkdirSync(userConvertedDir, { recursive: true });

        const originalNameBase = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${originalNameBase}_nowatermark.docx`;
        const newStoredName = `${crypto.randomUUID()}.docx`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        zip.writeZip(targetPath);

        const newSize = fs.statSync(targetPath).size;
        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, file.file_type, file.mime_type, newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);

        return res.status(201).json({
            message: 'Watermark removed successfully.',
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

const docx = require('docx');
const docxOptimizerService = require('../services/docxOptimizer.service');

exports.saveNewDocx = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, paragraphs } = req.body;

        const docChildren = (paragraphs && paragraphs.length > 0 ? paragraphs : ['New Document Content']).map(p => {
            const text = typeof p === 'string' ? p : (p.text || ' ');
            const isHeading = p.heading === 1 ? docx.HeadingLevel.HEADING_1 : (p.heading === 2 ? docx.HeadingLevel.HEADING_2 : undefined);
            return new docx.Paragraph({
                heading: isHeading,
                children: [
                    new docx.TextRun({
                        text: text,
                        bold: p.bold === true,
                        italics: p.italic === true,
                        size: isHeading ? 28 : 24
                    })
                ]
            });
        });

        const docxDoc = new docx.Document({
            sections: [{ children: docChildren }]
        });

        const buffer = await docx.Packer.toBuffer(docxDoc);
        const fileName = (title || 'document').replace(/\.docx$/i, '') + `_${Date.now()}.docx`;
        const storedName = `${crypto.randomUUID()}.docx`;
        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        if (!fs.existsSync(userConvertedDir)) fs.mkdirSync(userConvertedDir, { recursive: true });
        const targetPath = path.join(userConvertedDir, storedName);

        fs.writeFileSync(targetPath, buffer);
        const newSize = buffer.length;

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, fileName, storedName, 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', newSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(newSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        return res.status(201).json({
            message: 'Word document saved successfully.',
            file: createdFile,
            downloadUrl
        });
    } catch(err) {
        next(err);
    }
};

/**
 * Optimize and compress Word DOCX document
 */
exports.optimizeDocx = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.id || req.body.fileId;
        const { level = 'recommended' } = req.body;

        if (!fileId) return res.status(400).json({ error: 'File ID is required.' });

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const sourcePath = path.resolve(path.normalize(file.storage_path));
        if (!fs.existsSync(sourcePath)) return res.status(404).json({ error: 'File not found on disk.' });

        const userConvertedDir = path.join(storageRoot, 'converted', String(userId));
        if (!fs.existsSync(userConvertedDir)) fs.mkdirSync(userConvertedDir, { recursive: true });

        const baseName = file.original_name.substring(0, file.original_name.lastIndexOf('.')) || file.original_name;
        const newOriginalName = `${baseName}_optimized.docx`;
        const newStoredName = `${crypto.randomUUID()}.docx`;
        const targetPath = path.join(userConvertedDir, newStoredName);

        const stats = await docxOptimizerService.optimizeDocx(sourcePath, targetPath, { level });

        const fileResult = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, newOriginalName, newStoredName, 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', stats.optimizedSize, targetPath);

        db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(stats.optimizedSize, userId);
        const createdFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileResult.lastInsertRowid);
        const downloadUrl = `/api/files/${createdFile.id}/download`;

        return res.status(201).json({
            message: stats.percentageSaved > 0 
                ? `Word document optimized (${stats.percentageSaved}% saved)!` 
                : 'Word document is already highly streamlined.',
            result: {
                id: createdFile.id,
                originalName: newOriginalName,
                originalSize: stats.originalSize,
                compressedSize: stats.optimizedSize,
                percentageSaved: stats.percentageSaved,
                mediaOptimizedCount: stats.mediaOptimizedCount,
                downloadUrl
            }
        });
    } catch(err) {
        next(err);
    }
};

