const db = require('../config/db');

// Default limits per tier (Free / Basic / Pro)
const DEFAULT_LIMITS = {
    humanizer_chars: 2000,
    transcription_minutes: 60,
    ai_documents: 50,
    ai_workflows: 25
};

/**
 * Get or initialize user usage stats
 */
function getUserUsage(userId) {
    if (!userId) {
        return {
            humanizer_chars: { used: 0, limit: DEFAULT_LIMITS.humanizer_chars, remaining: DEFAULT_LIMITS.humanizer_chars },
            transcription_minutes: { used: 0, limit: DEFAULT_LIMITS.transcription_minutes, remaining: DEFAULT_LIMITS.transcription_minutes },
            ai_documents: { used: 0, limit: DEFAULT_LIMITS.ai_documents, remaining: DEFAULT_LIMITS.ai_documents },
            ai_workflows: { used: 0, limit: DEFAULT_LIMITS.ai_workflows, remaining: DEFAULT_LIMITS.ai_workflows }
        };
    }

    const user = db.prepare('SELECT usage_stats FROM users WHERE id = ?').get(userId);
    let stats = {};
    if (user && user.usage_stats) {
        try {
            stats = typeof user.usage_stats === 'string' ? JSON.parse(user.usage_stats) : user.usage_stats;
        } catch (e) {
            stats = {};
        }
    }

    const usage = {
        humanizer_chars: {
            used: stats.humanizer_chars || 0,
            limit: stats.humanizer_limit || DEFAULT_LIMITS.humanizer_chars,
            remaining: Math.max(0, (stats.humanizer_limit || DEFAULT_LIMITS.humanizer_chars) - (stats.humanizer_chars || 0))
        },
        transcription_minutes: {
            used: stats.transcription_minutes || 0,
            limit: stats.transcription_limit || DEFAULT_LIMITS.transcription_minutes,
            remaining: Math.max(0, (stats.transcription_limit || DEFAULT_LIMITS.transcription_minutes) - (stats.transcription_minutes || 0))
        },
        ai_documents: {
            used: stats.ai_documents || 0,
            limit: stats.ai_documents_limit || DEFAULT_LIMITS.ai_documents,
            remaining: Math.max(0, (stats.ai_documents_limit || DEFAULT_LIMITS.ai_documents) - (stats.ai_documents || 0))
        },
        ai_workflows: {
            used: stats.ai_workflows || 0,
            limit: stats.ai_workflows_limit || DEFAULT_LIMITS.ai_workflows,
            remaining: Math.max(0, (stats.ai_workflows_limit || DEFAULT_LIMITS.ai_workflows) - (stats.ai_workflows || 0))
        }
    };

    return usage;
}

/**
 * Check if user has sufficient quota for an action
 */
function checkQuota(userId, metric, requestedAmount = 1) {
    const usage = getUserUsage(userId);
    const item = usage[metric];
    if (!item) return { allowed: true, remaining: 999999 };
    return {
        allowed: item.remaining >= requestedAmount,
        remaining: item.remaining,
        used: item.used,
        limit: item.limit,
        requested: requestedAmount
    };
}

/**
 * Consume quota for a specific metric
 */
function consumeQuota(userId, metric, amount = 1) {
    if (!userId) return true;

    const check = checkQuota(userId, metric, amount);
    if (!check.allowed) {
        const error = new Error(`Usage limit exceeded for ${metric.replace('_', ' ')}. Remaining allowance: ${check.remaining}.`);
        error.statusCode = 429;
        error.code = 'QUOTA_EXCEEDED';
        error.quotaDetails = check;
        throw error;
    }

    const currentUsage = getUserUsage(userId);
    const newStats = {
        humanizer_chars: currentUsage.humanizer_chars.used + (metric === 'humanizer_chars' ? amount : 0),
        humanizer_limit: currentUsage.humanizer_chars.limit,
        transcription_minutes: currentUsage.transcription_minutes.used + (metric === 'transcription_minutes' ? amount : 0),
        transcription_limit: currentUsage.transcription_minutes.limit,
        ai_documents: currentUsage.ai_documents.used + (metric === 'ai_documents' ? amount : 0),
        ai_documents_limit: currentUsage.ai_documents.limit,
        ai_workflows: currentUsage.ai_workflows.used + (metric === 'ai_workflows' ? amount : 0),
        ai_workflows_limit: currentUsage.ai_workflows.limit
    };

    db.prepare('UPDATE users SET usage_stats = ? WHERE id = ?').run(JSON.stringify(newStats), userId);

    return {
        success: true,
        consumed: amount,
        remaining: check.remaining - amount
    };
}

module.exports = {
    DEFAULT_LIMITS,
    getUserUsage,
    checkQuota,
    consumeQuota
};
