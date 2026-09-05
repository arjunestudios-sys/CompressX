require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const cleanupService = require('./services/cleanup.service');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Headers
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts and assets on localhost
}));

// CORS Configuration
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// Passport OAuth Initialization
app.use(passport.initialize());

// Rate Limiting for Authentication Endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve Frontend Static Files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/files', require('./routes/files.routes'));
app.use('/api/compress', require('./routes/compress.routes'));
app.use('/api/extract', require('./routes/extract.routes'));
app.use('/api/convert', require('./routes/convert.routes'));

// Catch-all route to serve static frontend pages
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    const reqPath = req.path === '/' ? 'index.html' : req.path;
    const targetFile = path.join(frontendPath, reqPath);
    if (require('fs').existsSync(targetFile)) {
        return res.sendFile(targetFile);
    }
    return res.sendFile(path.join(frontendPath, 'index.html'));
});

// Central Error Handler
app.use(errorHandler);

// Start Server & Cleanup Job
app.listen(PORT, () => {
    console.log(`\n🚀 CompressX Backend Server running on http://localhost:${PORT}`);
    console.log(`💻 Serving Frontend directly on http://localhost:${PORT}\n`);
    cleanupService.startCleanupJob();
});
