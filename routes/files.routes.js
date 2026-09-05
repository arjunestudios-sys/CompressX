const express = require('express');
const router = express.Router();
const filesController = require('../controllers/files.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

router.use(authMiddleware);

router.post('/upload', uploadMiddleware.single('file'), filesController.uploadFile);
router.get('/', filesController.listFiles);
router.get('/:id', filesController.getFile);
router.get('/:id/download', filesController.downloadFile);
router.delete('/:id', filesController.deleteFile);

module.exports = router;
