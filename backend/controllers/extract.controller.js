const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const extractionService = require('../services/extraction.service');
const compressionService = require('../services/compression.service');

// Memory store for extraction jobs on localhost
const activeJobs = new Map();

exports.extractArchive = async (req, res, next) => {
    try {
        const userId = req.user.id;
        let archivePath = null;
        let archiveName = 'archive';

        if (req.file) {
            archivePath = req.file.path;
            archiveName = req.file.originalname;
        } else if (req.body.fileId) {
            const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(req.body.fileId, userId);
            if (!file) {
                return res.status(404).json({ error: 'Selected archive file not found.' });
            }
            archivePath = path.normalize(file.storage_path);
            archiveName = file.original_name;
        } else {
            return res.status(400).json({ error: 'Please select an archive file to extract.' });
        }

        if (!fs.existsSync(archivePath)) {
            return res.status(404).json({ error: 'Archive file not found on server.' });
        }

        const jobId = crypto.randomUUID();
        const destDir = path.join(__dirname, '../storage/temp', `extracted_${jobId}`);

        const files = await extractionService.extractArchive(archivePath, destDir);

        const extractedList = files.map((f, index) => ({
            id: index,
            name: f.name,
            size: f.size,
            downloadUrl: `/api/extract/${jobId}/file/${index}`
        }));

        activeJobs.set(jobId, {
            jobId,
            userId,
            archiveName,
            destDir,
            files
        });

        return res.json({
            message: 'Archive extracted successfully.',
            jobId,
            archiveName,
            totalFiles: extractedList.length,
            files: extractedList,
            downloadAllUrl: `/api/extract/${jobId}/download-all`
        });
    } catch (err) {
        next(err);
    }
};

exports.getExtractionStatus = async (req, res) => {
    const { jobId } = req.params;
    const job = activeJobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'Extraction job not found or expired.' });
    return res.json({ status: 'completed', totalFiles: job.files.length });
};

exports.getExtractedFiles = async (req, res) => {
    const { jobId } = req.params;
    const job = activeJobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'Extraction job not found or expired.' });

    const fileList = job.files.map((f, index) => ({
        id: index,
        name: f.name,
        size: f.size,
        downloadUrl: `/api/extract/${jobId}/file/${index}`
    }));

    return res.json({ jobId, archiveName: job.archiveName, files: fileList });
};

exports.downloadExtractedFile = async (req, res) => {
    const { jobId, index } = req.params;
    const job = activeJobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'Extraction job not found or expired.' });

    const fileIdx = parseInt(index, 10);
    const item = job.files[fileIdx];
    if (!item || !fs.existsSync(item.path)) {
        return res.status(404).json({ error: 'Extracted file not found.' });
    }

    return res.download(item.path, path.basename(item.name));
};

exports.downloadAllAsZip = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const job = activeJobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Extraction job not found or expired.' });

        const zipOutputPath = path.join(__dirname, '../storage/temp', `rezipped_${jobId}.zip`);

        const itemsToZip = job.files.map(f => ({
            storage_path: f.path,
            original_name: f.name,
            file_size: f.size
        }));

        await compressionService.compressFiles(itemsToZip, zipOutputPath, 'zip');

        const cleanArchiveName = job.archiveName.replace(/\.[^/.]+$/, "") + "_extracted.zip";
        return res.download(zipOutputPath, cleanArchiveName, () => {
            if (fs.existsSync(zipOutputPath)) fs.unlinkSync(zipOutputPath);
        });
    } catch (err) {
        next(err);
    }
};
