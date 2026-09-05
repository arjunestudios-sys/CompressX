const express = require('express');
const router = express.Router();
const compressController = require('../controllers/compress.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', compressController.compressFiles);
router.get('/:jobId/status', compressController.getCompressionStatus);

module.exports = router;
