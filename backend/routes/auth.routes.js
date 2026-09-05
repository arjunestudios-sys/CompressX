const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authController.logout);

// Google OAuth routes
router.get('/google', (req, res, next) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
        return passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
    }
    return res.status(400).json({ error: 'Google OAuth not configured in backend/.env' });
});

router.get('/google/callback', (req, res, next) => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
        return passport.authenticate('google', { failureRedirect: '/login.html?error=google_failed', session: false })(req, res, next);
    }
    return res.redirect('/login.html');
}, (req, res) => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'compressx_super_secret_jwt_key_2026_localhost';
    const token = jwt.sign({ id: req.user.id, email: req.user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, { httpOnly: true, sameSite: 'Lax', maxAge: 3600000 });
    res.redirect('/dashboard.html');
});

module.exports = router;
