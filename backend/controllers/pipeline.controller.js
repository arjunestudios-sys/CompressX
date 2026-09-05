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
