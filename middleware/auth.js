const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'compressx_super_secret_jwt_key_2026');

function authMiddleware(req, res, next) {
    let token = null;

    // Check cookies first
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    // Fallback to Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, name, email, google_id, profile_image, storage_used, notification_prefs, created_at FROM users WHERE id = ?').get(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'Authentication required. Please sign in.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
}

module.exports = authMiddleware;
