const express = require('express');
const router = express.Router();
const filesController = require('../controllers/files.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

router.use(authMiddleware);

router.post('/upload', uploadMiddleware.single('file'), filesController.uploadFile);
router.get('/', filesController.listFiles);
router.post('/download-zip', filesController.downloadMultipleAsZip);
router.get('/:id/inspect', filesController.inspectFile);
router.get('/:id', filesController.getFile);
router.get('/:id/download', filesController.downloadFile);
router.delete('/:id', filesController.deleteFile);
router.put('/:id/rename', filesController.renameFile);
router.put('/:id/content', filesController.updateFileContent);
router.post('/:id/watermark/frontend', filesController.saveWatermarkRemoved);

module.exports = router;
