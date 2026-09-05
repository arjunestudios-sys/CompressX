function errorHandler(err, req, res, next) {
    console.error('❌ Server Error:', err);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'This file is too large to upload.' });
    }

    if (err.message && err.message.includes('MIME')) {
        return res.status(400).json({ error: "This file type isn't supported." });
    }

    const message = err.statusMessage || err.message || 'An unexpected error occurred.';
    res.status(err.status || 500).json({ error: message });
}

module.exports = errorHandler;
