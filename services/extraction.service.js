const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const tar = require('tar');

/**
 * Extracts archive file to a destination directory
 * @param {string} archivePath 
 * @param {string} destDir 
 * @returns {Promise<Array<{name: string, size: number, path: string}>>}
 */
async function extractArchive(archivePath, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const ext = path.extname(archivePath).toLowerCase();

    if (ext === '.zip') {
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(destDir, true);
    } else if (ext === '.gz' || ext === '.tgz' || ext === '.tar') {
        await tar.x({
            file: archivePath,
            cwd: destDir
        });
    } else {
        // Fallback try AdmZip
        try {
            const zip = new AdmZip(archivePath);
            zip.extractAllTo(destDir, true);
        } catch(e) {
            throw new Error("Unable to extract this file. It may be corrupted or in an unsupported format.");
        }
    }

    // Recursively collect extracted files
    const extractedFiles = [];

    function walk(currentDir, relativePrefix = '') {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const relPath = relativePrefix ? path.join(relativePrefix, item) : item;
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walk(fullPath, relPath);
            } else {
                extractedFiles.push({
                    name: relPath,
                    size: stat.size,
                    path: fullPath
                });
            }
        }
    }

    walk(destDir);
    return extractedFiles;
}

module.exports = {
    extractArchive
};
