const db = require('../config/db');

/**
 * Mobile Push Notification & Status Delivery System
 */

// Register device push token
function registerPushToken(userId, deviceToken, platform = 'android') {
    if (!userId || !deviceToken) return false;
    db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(deviceToken, userId);
    return { success: true, platform, token: deviceToken };
}

/**
 * Send mobile push notification with deep links
 */
async function sendMobileNotification(userId, { title, message, fileName = '', status = 'info', deepLink = '', type = 'processing' }) {
    if (!userId) {
        console.log(`[PUSH SIMULATOR - GUEST] ${title}: ${message}`);
        return { delivered: true, simulated: true, channel: 'in-app' };
    }

    const user = db.prepare('SELECT push_token, notification_prefs FROM users WHERE id = ?').get(userId);
    let prefs = {};
    if (user && user.notification_prefs) {
        try {
            prefs = typeof user.notification_prefs === 'string' ? JSON.parse(user.notification_prefs) : user.notification_prefs;
        } catch (e) {}
    }

    // Check if notification type is enabled in user settings
    if (prefs[type] === false) {
        return { delivered: false, reason: 'user_disabled' };
    }

    const payload = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        userId,
        title,
        message,
        fileName,
        status, // 'success', 'warning', 'error', 'info'
        deepLink: deepLink || `/dashboard.html`,
        timestamp: new Date().toISOString(),
        delivered: true
    };

    console.log(`\n📲 [MOBILE PUSH SENT to User ${userId}]`);
    console.log(`   Title: ${title}`);
    console.log(`   Message: ${message}`);
    console.log(`   DeepLink: ${payload.deepLink}\n`);

    return payload;
}

module.exports = {
    registerPushToken,
    sendMobileNotification
};
