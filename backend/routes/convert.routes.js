const express = require('express');
const router = express.Router();
const convertController = require('../controllers/convert.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/formats/:fileId', convertController.getFileFormats);
router.post('/image', convertController.convertImage);
router.post('/document', convertController.convertDocument);
router.post('/multi-export', convertController.multiExport);
router.post('/smart-compress', convertController.smartCompress);
router.post('/target-size', convertController.targetSizeOptimization);
router.post('/optimize', convertController.optimizeFile);
router.post('/prepare', convertController.prepareFile);
router.post('/batch', convertController.batchConvert);
router.post('/assistant-query', convertController.assistantQuery);

// History
router.get('/history', convertController.getTransformationHistory);
router.delete('/history', convertController.clearTransformationHistory);
router.delete('/history/:id', convertController.deleteTransformationHistory);

module.exports = router;
