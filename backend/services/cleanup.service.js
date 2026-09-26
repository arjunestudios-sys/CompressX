const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('../config/db');

// 1 Day Process Timing & Retention Constant (24 hours)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function cleanDirectoryOlderThan(directoryPath, maxAgeMs) {
    if (!fs.existsSync(directoryPath)) return;
    const now = Date.now();

    try {
        const entries = fs.readdirSync(directoryPath);
        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry);
            const stat = fs.statSync(entryPath);

            if (stat.isDirectory()) {
                cleanDirectoryOlderThan(entryPath, maxAgeMs);
                // Remove directory if empty
                try {
                    if (fs.readdirSync(entryPath).length === 0) {
                        fs.rmdirSync(entryPath);
                    }
                } catch(e) {}
            } else if (now - stat.mtimeMs > maxAgeMs) {
                try {
                    fs.unlinkSync(entryPath);
                } catch(e) {}
            }
        }
    } catch (err) {
        console.warn(`⚠️ Cleanup notice for ${directoryPath}:`, err.message);
    }
}

function runOneDayCleanup() {
    const storageRoot = path.join(__dirname, '../storage');
    const targetDirs = [
        path.join(storageRoot, 'temp'),
        path.join(storageRoot, 'converted'),
        path.join(storageRoot, 'compressed')
    ];

    targetDirs.forEach(dir => {
        cleanDirectoryOlderThan(dir, ONE_DAY_MS);
    });

    // Clean expired share links (> 24 hours / 1 day) from database
    try {
        const dbPath = path.join(__dirname, '../database/compressx.json');
        if (fs.existsSync(dbPath)) {
            const loaded = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const nowIso = new Date().toISOString();
            const oneDayAgo = new Date(Date.now() - ONE_DAY_MS).toISOString();

            if (Array.isArray(loaded.share_links)) {
                loaded.share_links = loaded.share_links.filter(s => s.expires_at && s.expires_at > nowIso);
            }
            if (Array.isArray(loaded.transformations)) {
                loaded.transformations = loaded.transformations.filter(t => t.created_at && t.created_at > oneDayAgo);
            }
            fs.writeFileSync(dbPath, JSON.stringify(loaded, null, 2), 'utf8');
        }
    } catch(e) {}
}

function startCleanupJob() {
    // Run initial cleanup on startup
    runOneDayCleanup();

    // Schedule recurring cleanup job to run every hour
    cron.schedule('0 * * * *', () => {
        runOneDayCleanup();
    });

    console.log('⏳ Scheduled file process retention & cleanup service: 1 DAY (24 Hours) timing.');
}

module.exports = {
    startCleanupJob,
    runOneDayCleanup,
    ONE_DAY_MS
};
