const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'compressx_super_secret_jwt_key_2026_localhost';

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

    if (!token) {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare(
            'SELECT id, username, email, date_of_birth, storage_used, notification_prefs, last_login, created_at FROM users WHERE id = ?'
        ).get(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
        }

        // Never expose the password hash to routes
        const { password_hash, ...safeUser } = user;
        req.user = safeUser;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
}

module.exports = authMiddleware;
