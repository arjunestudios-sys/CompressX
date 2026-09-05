const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_BYTES || '209715200', 10); // 200MB default

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user ? req.user.id : 'guest';
        const userDir = path.join(__dirname, '../storage/uploads', String(userId));
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const secureName = `${crypto.randomUUID()}${ext}`;
        cb(null, secureName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: maxFileSize }
});

module.exports = upload;
