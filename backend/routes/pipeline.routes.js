const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipeline.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/execute', pipelineController.executePipeline);

module.exports = router;
