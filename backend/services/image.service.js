const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument: PDFLib } = require('pdf-lib');

/**
 * Compress an image with quality or target size
 */
async function compressImage(inputPath, outputPath, options = {}) {
    const meta = await sharp(inputPath).metadata();
    const ext = path.extname(outputPath).toLowerCase().slice(1) || meta.format || 'webp';

    // Target size optimization (e.g. make smaller than 1MB)
    if (options.targetSizeBytes && options.targetSizeBytes > 0) {
        const targetLimit = parseInt(options.targetSizeBytes, 10);
        let quality = 85;
        let widthScale = 1.0;
        let bestBuffer = null;

        for (let step = 0; step < 6; step++) {
            let img = sharp(inputPath);
            if (widthScale < 1.0 && meta.width) {
                img = img.resize(Math.round(meta.width * widthScale));
            }

            let buf;
            if (ext === 'png') {
                buf = await img.webp({ quality }).toBuffer();
            } else if (ext === 'webp') {
                buf = await img.webp({ quality, effort: 6 }).toBuffer();
            } else {
                buf = await img.jpeg({ quality, mozjpeg: true }).toBuffer();
            }

            bestBuffer = buf;
            if (buf.length <= targetLimit) break;

            quality = Math.max(15, quality - 15);
            widthScale = Math.max(0.3, widthScale - 0.15);
        }

        fs.writeFileSync(outputPath, bestBuffer);
        return { outputPath, size: bestBuffer.length, width: meta.width, height: meta.height };
    }

    // Quality-based compression
    const quality = Math.min(100, Math.max(1, parseInt(options.quality, 10) || 80));
    let pipeline = sharp(inputPath);

    if (options.stripMetadata !== false) {
        // Strip EXIF
        pipeline = pipeline.rotate(); // auto-orient before stripping
    }

    if (ext === 'jpg' || ext === 'jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (ext === 'webp') {
        pipeline = pipeline.webp({ quality, effort: 6 });
    } else if (ext === 'png') {
        pipeline = pipeline.png({ compressionLevel: 9, quality: Math.min(quality, 95) });
    } else if (ext === 'tiff') {
        pipeline = pipeline.tiff({ quality });
    }

    await pipeline.toFile(outputPath);
    const stat = fs.statSync(outputPath);
    return { outputPath, size: stat.size };
}

/**
 * Resize image
 */
async function resizeImage(inputPath, outputPath, options = {}) {
    const meta = await sharp(inputPath).metadata();
    let { width, height, scale, preset } = options;

    if (preset) {
        if (preset === '4k') { width = 3840; height = 2160; }
        else if (preset === '1080p') { width = 1920; height = 1080; }
        else if (preset === '720p') { width = 1280; height = 720; }
        else if (preset === '480p') { width = 854; height = 480; }
        else if (preset === 'square' || preset === '1:1') { width = 1080; height = 1080; }
        else if (preset === 'twitter' || preset === 'twitter_post' || preset === 'x') { width = 1200; height = 675; }
        else if (preset === 'twitter_avatar' || preset === 'x_avatar') { width = 400; height = 400; }
        else if (preset === 'threads' || preset === 'instagram' || preset === 'instagram_square') { width = 1080; height = 1080; }
        else if (preset === 'threads_portrait' || preset === 'instagram_portrait') { width = 1080; height = 1350; }
        else if (preset === 'reels' || preset === 'tiktok' || preset === 'shorts') { width = 1080; height = 1920; }
        else if (preset === 'discord_avatar') { width = 256; height = 256; }
        else if (preset === 'discord_emote') { width = 128; height = 128; }
        else if (preset === 'youtube_thumb' || preset === 'youtube_thumbnail') { width = 1280; height = 720; }
        else if (preset === 'linkedin' || preset === 'linkedin_post') { width = 1200; height = 627; }
        else if (preset === '50%') { scale = 0.5; }
        else if (preset === '25%') { scale = 0.25; }
    }

    if (scale && meta.width) {
        width = Math.round(meta.width * parseFloat(scale));
        height = meta.height ? Math.round(meta.height * parseFloat(scale)) : undefined;
    }

    let pipeline = sharp(inputPath);
    pipeline = pipeline.resize({
        width: width ? parseInt(width, 10) : undefined,
        height: height ? parseInt(height, 10) : undefined,
        fit: options.fit || 'inside',
        withoutEnlargement: options.withoutEnlargement !== false
    });

    const ext = path.extname(outputPath).toLowerCase().slice(1) || meta.format || 'jpg';
    if (ext === 'webp') pipeline = pipeline.webp({ quality: 85 });
    else if (ext === 'png') pipeline = pipeline.png();
    else pipeline = pipeline.jpeg({ quality: 85 });

    await pipeline.toFile(outputPath);
    const stat = fs.statSync(outputPath);
    const newMeta = await sharp(outputPath).metadata();

    return {
        outputPath,
        size: stat.size,
        beforeDimensions: `${meta.width}x${meta.height}`,
        afterDimensions: `${newMeta.width}x${newMeta.height}`
    };
}

/**
 * Crop image
 */
async function cropImage(inputPath, outputPath, cropOptions) {
    const { left = 0, top = 0, width = 100, height = 100 } = cropOptions;
    await sharp(inputPath)
        .extract({
            left: Math.max(0, parseInt(left, 10)),
            top: Math.max(0, parseInt(top, 10)),
            width: Math.max(1, parseInt(width, 10)),
            height: Math.max(1, parseInt(height, 10))
        })
        .toFile(outputPath);

    return { outputPath, size: fs.statSync(outputPath).size };
}

/**
 * Rotate & Flip image
 */
async function rotateFlipImage(inputPath, outputPath, transformOptions = {}) {
    let pipeline = sharp(inputPath);

    if (transformOptions.rotate) {
        pipeline = pipeline.rotate(parseInt(transformOptions.rotate, 10));
    }
    if (transformOptions.flip) {
        pipeline = pipeline.flip(); // vertical flip
    }
    if (transformOptions.flop) {
        pipeline = pipeline.flop(); // horizontal mirror
    }

    await pipeline.toFile(outputPath);
    return { outputPath, size: fs.statSync(outputPath).size };
}

/**
 * Strip metadata (EXIF/IPTC/XMP)
 */
async function stripMetadata(inputPath, outputPath) {
    await sharp(inputPath)
        .rotate() // orient
        .withMetadata(false) // removes all EXIF
        .toFile(outputPath);

    return { outputPath, size: fs.statSync(outputPath).size };
}

/**
 * Convert Image to Target Format
 */
function getPageDimensions(pageSize = 'auto', orientation = 'portrait', imgW = 600, imgH = 800) {
    const sizeMap = {
        a4: [595.28, 841.89],
        letter: [612.00, 792.00],
        legal: [612.00, 1008.00]
    };
    const normSize = (pageSize || 'auto').toLowerCase();
    if (normSize === 'auto' || !sizeMap[normSize]) {
        return [imgW, imgH];
    }
    const [w, h] = sizeMap[normSize];
    if (orientation === 'landscape') {
        return [Math.max(w, h), Math.min(w, h)];
    }
    return [Math.min(w, h), Math.max(w, h)];
}

function calculateImagePlacement(imgWidth, imgHeight, pageWidth, pageHeight, fit = 'contain') {
    if (pageWidth === imgWidth && pageHeight === imgHeight) {
        return { x: 0, y: 0, width: imgWidth, height: imgHeight };
    }
    const margin = 20;
    const maxW = Math.max(10, pageWidth - (margin * 2));
    const maxH = Math.max(10, pageHeight - (margin * 2));

    if (fit === 'fill') {
        return { x: 0, y: 0, width: pageWidth, height: pageHeight };
    }

    const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    return { x, y, width: drawWidth, height: drawHeight };
}

/**
 * Convert Image to Target Format
 */
async function convertImage(inputPath, outputPath, targetFormat, options = {}) {
    const norm = targetFormat.toLowerCase().trim();
    const q = Math.min(100, Math.max(1, parseInt(options.quality, 10) || 85));

    if (norm === 'pdf') {
        const pdfDoc = await PDFLib.create();
        let imageBuffer = fs.readFileSync(inputPath);
        const meta = await sharp(inputPath).metadata();

        let image;
        if (meta.format === 'png') {
            try { image = await pdfDoc.embedPng(imageBuffer); }
            catch(e) {
                imageBuffer = await sharp(imageBuffer).jpeg().toBuffer();
                image = await pdfDoc.embedJpg(imageBuffer);
            }
        } else {
            imageBuffer = await sharp(imageBuffer).jpeg({ quality: q }).toBuffer();
            image = await pdfDoc.embedJpg(imageBuffer);
        }

        const pageSize = options.pageSize || 'auto';
        const orientation = options.orientation || 'portrait';
        const fit = options.fit || 'contain';

        const [pageW, pageH] = getPageDimensions(pageSize, orientation, image.width, image.height);
        const placement = calculateImagePlacement(image.width, image.height, pageW, pageH, fit);

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(image, { x: placement.x, y: placement.y, width: placement.width, height: placement.height });
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
    } else {
        let pipeline = sharp(inputPath);
        if (norm === 'jpeg' || norm === 'jpg') pipeline = pipeline.jpeg({ quality: q });
        else if (norm === 'webp') pipeline = pipeline.webp({ quality: q });
        else if (norm === 'png') pipeline = pipeline.png({ compressionLevel: 9 });
        else if (norm === 'tiff') pipeline = pipeline.tiff({ quality: q });
        else if (norm === 'gif') pipeline = pipeline.gif();
        else if (norm === 'bmp') {
            const pngBuf = await pipeline.png().toBuffer();
            fs.writeFileSync(outputPath, pngBuf);
            return { outputPath, size: fs.statSync(outputPath).size };
        }

        await pipeline.toFile(outputPath);
    }

    return { outputPath, size: fs.statSync(outputPath).size };
}

/**
 * Combine multiple images into a single PDF
 */
async function imagesToPdf(imagePaths, outputPath, options = {}) {
    const pdfDoc = await PDFLib.create();

    for (const imgPath of imagePaths) {
        if (!fs.existsSync(imgPath)) {
            throw new Error(`Unable to combine: "${path.basename(imgPath)}" was not found on disk.`);
        }
        let buffer;
        try {
            buffer = fs.readFileSync(imgPath);
        } catch(e) {
            throw new Error(`Unable to read: "${path.basename(imgPath)}".`);
        }
        const meta = await sharp(imgPath).metadata();
        let image;

        if (meta.format === 'png') {
            try { image = await pdfDoc.embedPng(buffer); }
            catch(e) {
                buffer = await sharp(buffer).jpeg().toBuffer();
                image = await pdfDoc.embedJpg(buffer);
            }
        } else {
            buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
            image = await pdfDoc.embedJpg(buffer);
        }

        const pageSize = options.pageSize || 'auto';
        const orientation = options.orientation || 'portrait';
        const fit = options.fit || 'contain';

        const [pageW, pageH] = getPageDimensions(pageSize, orientation, image.width, image.height);
        const placement = calculateImagePlacement(image.width, image.height, pageW, pageH, fit);

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(image, { x: placement.x, y: placement.y, width: placement.width, height: placement.height });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    return { outputPath, size: fs.statSync(outputPath).size, pageCount: imagePaths.length };
}

module.exports = {
    compressImage,
    resizeImage,
    cropImage,
    rotateFlipImage,
    stripMetadata,
    convertImage,
    imagesToPdf,
    multiImageToPdf: imagesToPdf
};
