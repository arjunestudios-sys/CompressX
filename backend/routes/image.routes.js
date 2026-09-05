const express = require('express');
const router = express.Router();
const imageController = require('../controllers/image.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/compress', imageController.compressImage);
router.post('/resize', imageController.resizeImage);
router.post('/crop', imageController.cropImage);
router.post('/rotate-flip', imageController.rotateFlipImage);
router.post('/strip-exif', imageController.stripExif);
router.post('/multi-pdf', imageController.imagesToPdf);

module.exports = router;
