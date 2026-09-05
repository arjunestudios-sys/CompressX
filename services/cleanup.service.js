const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

function startCleanupJob() {
    const tempDir = path.join(__dirname, '../storage/temp');

    // Run every 15 minutes
    cron.schedule('*/15 * * * *', () => {
        if (!fs.existsSync(tempDir)) return;

        const now = Date.now();
        const maxAgeMs = 60 * 60 * 1000; // 1 hour

        try {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stat = fs.statSync(filePath);

                if (now - stat.mtimeMs > maxAgeMs) {
                    if (stat.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ Temp cleanup job notice:', err.message);
        }
    });

    console.log('⏳ Scheduled temp file cleanup service (every 15 min)');
}

module.exports = {
    startCleanupJob
};
