require('dotenv').config();
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

app.get('/favicon.ico', (req, res) => res.status(204).end());

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
app.use(express.static(frontendPath, {
    maxAge: '1h',
    etag: true
}));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/files', require('./routes/files.routes'));
app.use('/api/compress', require('./routes/compress.routes'));
app.use('/api/extract', require('./routes/extract.routes'));
app.use('/api/pdf', require('./routes/pdf.routes'));
app.use('/api/docx', require('./routes/docx.routes'));
app.use('/api/convert', require('./routes/convert.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/image', require('./routes/image.routes'));
app.use('/api/pipeline', require('./routes/pipeline.routes'));

// Catch-all route to serve static frontend pages
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }

    // Do not serve index.html for missing static assets or files
    if (req.path.includes('.') || req.path.startsWith('/assets/')) {
        return res.status(404).send('Not Found');
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
    console.log(`\n🚀 Docholder Universal File Processing Platform Server running on http://localhost:${PORT}`);
    console.log(`💻 Serving Frontend directly on http://localhost:${PORT}\n`);
    cleanupService.startCleanupJob();
});
