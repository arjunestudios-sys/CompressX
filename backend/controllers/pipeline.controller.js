const db = require('../config/db');
const pipelineService = require('../services/pipeline.service');

/**
 * Execute custom or conversational multi-step pipeline
 */
exports.executePipeline = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fileId, steps } = req.body;

        if (!fileId || !steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ error: 'File ID and an array of pipeline steps are required.' });
        }

        const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND status = "active"').get(fileId, userId);
        if (!file) return res.status(404).json({ error: 'File not found.' });

        const pipelineResult = await pipelineService.executePipeline(userId, file, steps);

        return res.status(201).json({
            message: 'Pipeline executed successfully.',
            result: pipelineResult
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Feature 28: AI Workflow Builder
 */
exports.builder = async (req, res, next) => {
    try {
        const { query } = req.body;
        const assistantService = require('../services/assistant.service');
        const parsed = assistantService.parseIntent(query || 'Convert images to WebP, resize to 1200px, compress and package ZIP');

        return res.json({
            query: query || 'Convert images to WebP, resize 1200px, compress and package ZIP',
            workflowName: 'Custom AI Workflow',
            steps: parsed.pipelineSteps || [
                { stage: 'Convert → WEBP', description: 'Convert image stream to WebP' },
                { stage: 'Resize → 1200px', description: 'Scale width to 1200px' },
                { stage: 'Compress', description: 'Apply 80% compression' },
                { stage: 'Package → ZIP', description: 'Create ZIP container' }
            ],
            confidence: 0.95
        });
    } catch (err) { next(err); }
};

/**
 * Feature 29: Reusable Automation Recipes
 */
exports.recipes = async (req, res, next) => {
    try {
        const recipes = pipelineService.getRecipes(req.user ? req.user.id : 0);
        return res.json({ recipes });
    } catch (err) { next(err); }
};
