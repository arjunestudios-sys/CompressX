const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/metadata/:id', mediaController.getMetadata);
router.post('/compress-video', mediaController.compressVideo);
router.post('/convert-video', mediaController.convertVideo);
router.post('/extract-audio', mediaController.extractAudio);
router.post('/trim-video', mediaController.trimVideo);
router.post('/convert-audio', mediaController.convertAudio);
router.post('/compress-audio', mediaController.compressAudio);
router.post('/trim-audio', mediaController.trimAudio);
router.post('/merge-audio', mediaController.mergeAudioFiles);
router.post('/volume-audio', mediaController.adjustAudioVolume);
router.post('/merge-video', mediaController.mergeVideoFiles);
router.post('/video-to-gif', mediaController.convertVideoToGif);
router.post('/transcribe-audio', mediaController.transcribeAudio);
router.post('/export-transcript', mediaController.exportTranscript);

module.exports = router;
