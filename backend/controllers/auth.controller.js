const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function getJwtSecret() {
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('localhost'))) {
        throw new Error('FATAL: A secure JWT_SECRET environment variable is required in production!');
    }
    return process.env.JWT_SECRET || 'compressx_super_secret_jwt_key_2026';
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'compressx_super_secret_jwt_key_2026');

// ─── Validation helpers ────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_MIN = 8;

function isValidDate(str) {
    const d = new Date(str);
    return !isNaN(d.getTime()) && str.match(/^\d{4}-\d{2}-\d{2}$/);
}

function generateToken(user, rememberMe = false) {
    // Session never expires (100 years duration)
    return jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '36500d' }
    );
}

function setTokenCookie(res, token, rememberMe = false) {
    // 100-year cookie duration
    const maxAge = 100 * 365 * 24 * 60 * 60 * 1000;
    const isHttps = process.env.NODE_ENV === 'production' || !!process.env.RENDER || true;
    res.cookie('token', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'None' : 'Lax',
        maxAge
    });
}

// ─── Register ──────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
    try {
        const { email, username, dateOfBirth, password, confirmPassword } = req.body;

        // Required field check
        if (!email || !username || !dateOfBirth || !password || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Email format
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        // Username format
        if (!USERNAME_REGEX.test(username)) {
            return res.status(400).json({ error: 'Username must be 3–30 characters and contain only letters, numbers, or underscores.' });
        }

        // Date of birth — must be valid, not future, user must be at least 8
        if (!isValidDate(dateOfBirth)) {
            return res.status(400).json({ error: 'Please enter a valid date of birth (YYYY-MM-DD).' });
        }
        const dob = new Date(dateOfBirth);
        const now = new Date();
        if (dob >= now) {
            return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
        }
        const ageYears = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
        if (ageYears < 8) {
            return res.status(400).json({ error: 'You must be at least 8 years old to register.' });
        }

        // Password strength
        if (password.length < PASSWORD_MIN) {
            return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters long.` });
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one letter and one number.' });
        }

        // Confirm password
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        // Uniqueness checks
        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existingEmail) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }

        const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
        if (existingUsername) {
            return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
        }

        // Hash password and store
        const passwordHash = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (username, email, date_of_birth, password_hash)
            VALUES (?, ?, ?, ?)
        `).run(username.trim(), email.toLowerCase().trim(), dateOfBirth, passwordHash);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully! You can now sign in.'
        });
    } catch (err) {
        console.error('REGISTER EXCEPTION:', err);
        next(err);
    }
};

// ─── Login ─────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
    try {
        const { username, password, rememberMe } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Please enter your username and password.' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());

        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Update last login
        db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

        const token = generateToken(user, !!rememberMe);
        setTokenCookie(res, token, !!rememberMe);

        const safeUser = { ...user };
        delete safeUser.password_hash;

        return res.json({
            success: true,
            message: 'Signed in successfully.',
            token,
            user: safeUser
        });
    } catch (err) {
        console.error('LOGIN EXCEPTION:', err);
        next(err);
    }
};

// ─── Forgot Password ───────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Please enter your email address.' });

        const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase().trim());

        // Always return same response to not reveal if email exists
        const resetToken = jwt.sign({ id: user ? user.id : 0 }, JWT_SECRET, { expiresIn: '15m' });
        const currentHost = req.protocol + '://' + req.get('host');
        const resetLink = `${currentHost}/login.html?resetToken=${resetToken}`;

        console.log(`\n🔑 [DEV RESET LINK FOR ${email}]: ${resetLink}\n`);

        return res.json({
            message: 'If an account exists with that email, a reset link has been sent.',
            devResetLink: resetLink  // Remove in production
        });
    } catch (err) {
        next(err);
    }
};

// ─── Reset Password ────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) {
            return res.status(400).json({ error: 'Invalid request.' });
        }

        if (newPassword.length < PASSWORD_MIN) {
            return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters long.` });
        }

        const decoded = jwt.verify(resetToken, JWT_SECRET);
        const passwordHash = await bcrypt.hash(newPassword, 12);

        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, decoded.id);

        return res.json({ message: 'Password updated successfully. You can now sign in.' });
    } catch (err) {
        return res.status(400).json({ error: 'Reset link has expired or is invalid.' });
    }
};

// ─── Get Current User ──────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
    return res.json({ user: req.user });
};

// ─── Logout ────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
    const isHttps = process.env.NODE_ENV === 'production' || !!process.env.RENDER || true;
    res.clearCookie('token', {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'None' : 'Lax'
    });
    return res.json({ success: true, message: 'Signed out successfully.' });
};
