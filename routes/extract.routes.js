const express = require('express');
const router = express.Router();
const extractController = require('../controllers/extract.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

router.use(authMiddleware);

router.post('/', uploadMiddleware.single('file'), extractController.extractArchive);
router.get('/:jobId/status', extractController.getExtractionStatus);
router.get('/:jobId/files', extractController.getExtractedFiles);
router.get('/:jobId/file/:index', extractController.downloadExtractedFile);
router.get('/:jobId/download-all', extractController.downloadAllAsZip);

module.exports = router;
