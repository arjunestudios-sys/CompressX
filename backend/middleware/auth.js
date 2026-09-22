const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'compressx_super_secret_jwt_key_2026');

function authMiddleware(req, res, next) {
    let token = null;

    // Check httpOnly cookie first
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    // Fallback: Authorization Bearer header (for Capacitor / mobile)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    const guestUser = {
        id: 'guest',
        username: 'Guest',
        email: 'guest@docholder.local',
        storage_used: 0,
        isGuest: true
    };

    if (!token) {
        req.user = guestUser;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare(
            'SELECT id, username, email, date_of_birth, storage_used, notification_prefs, last_login, created_at FROM users WHERE id = ?'
        ).get(decoded.id);

        if (user) {
            const { password_hash, ...safeUser } = user;
            req.user = safeUser;
            return next();
        }
    } catch (err) {
        // Fall back to guest on invalid token
    }

    req.user = guestUser;
    next();
}

module.exports = authMiddleware;
