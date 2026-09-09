const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'compressx_super_secret_jwt_key_2026');

function generateToken(user, rememberMe = false) {
    // Session never expires (100 years duration)
    return jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '36500d' }
    );
}

function setTokenCookie(res, token, rememberMe = false) {
    // 100-year cookie duration
    const maxAge = 100 * 365 * 24 * 60 * 60 * 1000;
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: maxAge
    });
}

exports.register = async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Please provide all required fields.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        if (password.length < 8 || !/\d/.test(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one number.' });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existingUser) {
            return res.status(400).json({ error: 'Email address is already registered.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        `).run(name.trim(), email.toLowerCase().trim(), passwordHash);

        const user = db.prepare('SELECT id, name, email, profile_image, storage_used, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

        return res.status(201).json({
            message: 'Registration successful. Please sign in.',
            user
        });
    } catch (err) {
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password, rememberMe } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Please enter both email and password.' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

        if (!user || !user.password_hash) {
            return res.status(400).json({ error: 'Incorrect email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect email or password.' });
        }

        const token = generateToken(user, !!rememberMe);
        setTokenCookie(res, token, !!rememberMe);

        delete user.password_hash;

        return res.json({
            message: 'Signed in successfully.',
            token,
            user
        });
    } catch (err) {
        next(err);
    }
};

exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Please enter your email address.' });

        const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase().trim());
        
        // Generate reset token stub
        const resetToken = jwt.sign({ id: user ? user.id : 0 }, JWT_SECRET, { expiresIn: '15m' });
        const appBaseUrl = process.env.APP_URL || 'https://compressx-backend.onrender.com';
        const resetLink = `${appBaseUrl}/login.html?resetToken=${resetToken}`;

        console.log(`\n🔑 [DEVELOPMENT RESET LINK FOR ${email}]: ${resetLink}\n`);

        return res.json({
            message: 'Password reset link sent! (Check server console or use dev link below)',
            devResetLink: resetLink
        });
    } catch (err) {
        next(err);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) {
            return res.status(400).json({ error: 'Invalid request.' });
        }

        if (newPassword.length < 8 || !/\d/.test(newPassword)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one number.' });
        }

        const decoded = jwt.verify(resetToken, JWT_SECRET);
        const passwordHash = await bcrypt.hash(newPassword, 12);

        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, decoded.id);

        return res.json({ message: 'Password updated successfully. You can now sign in.' });
    } catch (err) {
        return res.status(400).json({ error: 'Reset link expired or invalid.' });
    }
};

exports.getMe = async (req, res) => {
    return res.json({ user: req.user });
};

exports.logout = async (req, res) => {
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully.' });
};
