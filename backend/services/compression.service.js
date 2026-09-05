const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * Compresses multiple files into an archive (.zip, .tar.gz)
 * @param {Array<{storage_path: string, original_name: string, file_size: number}>} files 
 * @param {string} outputPath 
 * @param {string} format ('zip' | 'tar.gz')
 * @returns {Promise<{compressedPath: string, originalSize: number, compressedSize: number, percentageSaved: number}>}
 */
function compressFiles(files, outputPath, format = 'zip', options = {}) {
    return new Promise((resolve, reject) => {
        const outDir = path.dirname(outputPath);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const output = fs.createWriteStream(outputPath);
        let archiveFormat = 'zip';
        let archiveOptions = { zlib: { level: options.level !== undefined ? options.level : 9 } };

        if (format === 'zip' && options.password) {
            archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));
            archiveFormat = 'zip-encrypted';
            archiveOptions.zlib = { level: options.level !== undefined ? options.level : 9 };
            archiveOptions.encryptionMethod = 'aes256';
            archiveOptions.password = options.password;
        }

        if (format === 'tar.gz') {
            archiveFormat = 'tar';
            archiveOptions = { gzip: true, gzipOptions: { level: options.level !== undefined ? options.level : 9 } };
        } else if (format === 'tar') {
            archiveFormat = 'tar';
            archiveOptions = {}; // Tar has no compression levels natively
        }

        const archive = archiver(archiveFormat, archiveOptions);

        let totalOriginalSize = 0;
        files.forEach(f => {
            totalOriginalSize += f.file_size || 0;
        });

        output.on('close', () => {
            const compressedSize = fs.statSync(outputPath).size;
            const percentageSaved = totalOriginalSize > 0 
                ? Math.max(0, Math.round((1 - (compressedSize / totalOriginalSize)) * 100))
                : 0;

            resolve({
                compressedPath: outputPath,
                originalSize: totalOriginalSize,
                compressedSize: compressedSize,
                percentageSaved: percentageSaved
            });
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        files.forEach(f => {
            if (fs.existsSync(f.storage_path)) {
                archive.file(f.storage_path, { name: f.original_name });
            }
        });

        archive.finalize();
    });
}

module.exports = {
    compressFiles
};
