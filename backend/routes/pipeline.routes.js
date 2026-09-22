const express = require('express');
const router = express.Router();
const pipelineController = require('../controllers/pipeline.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/execute', pipelineController.executePipeline);
router.post('/builder', pipelineController.builder);
router.get('/recipes', pipelineController.recipes);

module.exports = router;
