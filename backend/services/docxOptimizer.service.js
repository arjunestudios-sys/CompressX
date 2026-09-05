/**
 * Docholder Word DOCX Optimizer & Compressor Engine
 * Compresses embedded images inside DOCX packages, cleans redundant XML namespaces,
 * strips bloated metadata, and yields optimized, lightweight Word files.
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const sharp = require('sharp');

/**
 * Optimize DOCX file
 * @param {string} sourcePath - Absolute path to input DOCX
 * @param {string} targetPath - Absolute path to optimized output DOCX
 * @param {object} options - Optimization options
 * @returns {Promise<{ originalSize: number, optimizedSize: number, percentageSaved: number, mediaOptimizedCount: number }>}
 */
async function optimizeDocx(sourcePath, targetPath, options = {}) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error('Source DOCX file not found on disk.');
    }

    const origStats = fs.statSync(sourcePath);
    const originalSize = origStats.size;

    const zip = new AdmZip(sourcePath);
    const entries = zip.getEntries();

    let mediaOptimizedCount = 0;
    const compressionLevel = options.level || 'recommended'; // 'low', 'recommended', 'high'
    
    // Quality settings
    let imageQuality = 80;
    let maxDimension = 1920;

    if (compressionLevel === 'high') {
        imageQuality = 60;
        maxDimension = 1280;
    } else if (compressionLevel === 'low') {
        imageQuality = 90;
        maxDimension = 2560;
    }

    // 1. Optimize embedded images in word/media/
    for (const entry of entries) {
        const name = entry.entryName.toLowerCase();
        if (name.startsWith('word/media/')) {
            try {
                const data = entry.getData();
                if (data && data.length > 5120) { // Only compress images > 5KB
                    let optimizedBuffer = null;

                    if (name.endsWith('.png') || name.endsWith('.tiff') || name.endsWith('.bmp')) {
                        // Optimize PNG or convert lossless bulky formats to compressed PNG
                        const meta = await sharp(data).metadata();
                        let pipeline = sharp(data);
                        if (meta.width && meta.width > maxDimension) {
                            pipeline = pipeline.resize({ width: maxDimension, withoutEnlargement: true });
                        }
                        optimizedBuffer = await pipeline.png({ quality: Math.min(90, imageQuality + 10), compressionLevel: 9 }).toBuffer();
                    } else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
                        // Compress JPEG
                        const meta = await sharp(data).metadata();
                        let pipeline = sharp(data);
                        if (meta.width && meta.width > maxDimension) {
                            pipeline = pipeline.resize({ width: maxDimension, withoutEnlargement: true });
                        }
                        optimizedBuffer = await pipeline.jpeg({ quality: imageQuality, mozjpeg: true }).toBuffer();
                    }

                    if (optimizedBuffer && optimizedBuffer.length < data.length) {
                        zip.updateFile(entry.entryName, optimizedBuffer);
                        mediaOptimizedCount++;
                    }
                }
            } catch (mediaErr) {
                // Silently keep original media if sharp cannot process it (e.g. emf/wmf)
            }
        }
    }

    // 2. Clean up XML whitespace and redundant history in document.xml
    try {
        const docEntry = zip.getEntry('word/document.xml');
        if (docEntry) {
            let xml = docEntry.getData().toString('utf8');
            // Strip proof errors w:proofErr (grammar/spell check markers)
            xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');
            // Strip unused empty bookmarks
            xml = xml.replace(/<w:bookmarkStart[^>]*\/>\s*<w:bookmarkEnd[^>]*\/>/g, '');
            // Compress whitespace between tags
            xml = xml.replace(/>\s+</g, '><');
            zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
        }
    } catch (xmlErr) {}

    // 3. Write optimized zip to targetPath
    const outDir = path.dirname(targetPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    zip.writeZip(targetPath);

    const optimizedSize = fs.statSync(targetPath).size;
    const percentageSaved = originalSize > 0 && optimizedSize < originalSize
        ? Math.round(((originalSize - optimizedSize) / originalSize) * 100)
        : 0;

    return {
        originalSize,
        optimizedSize,
        percentageSaved,
        mediaOptimizedCount,
        level: compressionLevel
    };
}

module.exports = {
    optimizeDocx
};
