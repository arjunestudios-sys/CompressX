require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cleanupService = require('./services/cleanup.service');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/favicon.ico', (req, res) => res.status(204).end());

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable must be set in production mode!');
    process.exit(1);
}

// Security & Headers
app.use(helmet({
    contentSecurityPolicy: isProd ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://compressx-backend.onrender.com", "*"]
        }
    } : false
}));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : true;

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// Rate Limiting for Authentication Endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Health Check & Root API Status (For Render / API-only Hosting)
app.get('/health', (req, res) => res.json({ status: 'online', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => {
    // If request explicitly asks for JSON or API-only mode
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ status: 'online', service: 'Docholder / CompressX API Engine', version: '1.0.0' });
    }
    // API welcome response
    res.json({
        service: 'Docholder / CompressX API Engine',
        status: 'online',
        endpoints: '/api/auth, /api/files, /api/compress, /api/extract, /api/pdf, /api/docx, /api/convert, /api/media, /api/image'
    });
});

// Serve Frontend Static Files (if available)
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
