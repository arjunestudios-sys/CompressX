const express = require('express');
const router = express.Router();
const docxController = require('../controllers/docx.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:id/extract', docxController.extractText);
router.put('/:id/update', docxController.updateText);
router.post('/save-new', docxController.saveNewDocx);
router.post('/optimize', docxController.optimizeDocx);
router.post('/:id/optimize', docxController.optimizeDocx);
router.post('/:id/watermark', docxController.removeWatermark);

module.exports = router;
