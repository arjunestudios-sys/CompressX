const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdf.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.put('/:id/annotate', pdfController.annotatePdf);
router.post('/annotate', pdfController.annotatePdf);
router.post('/compress', pdfController.compressPdf);
router.post('/merge', pdfController.mergePdfs);
router.post('/split', pdfController.splitPdf);
router.post('/extract-pages', pdfController.extractPages);
router.post('/remove-pages', pdfController.removePages);
router.post('/rotate', pdfController.rotatePdf);
router.post('/watermark', pdfController.watermarkPdf);
router.post('/page-numbers', pdfController.addPageNumbers);
router.post('/protect', pdfController.protectPdf);
router.post('/redact', pdfController.redactPdf);
router.post('/sign', pdfController.signPdf);
router.post('/pdfa', pdfController.pdfToPdfA);
router.post('/compare', pdfController.comparePdfs);

module.exports = router;
