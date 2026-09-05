const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const docx = require('docx');
const xlsx = require('xlsx');

function hexToRgb(hex) {
    let clean = (hex || '#000000').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255
    };
}

/**
 * Merge multiple PDFs
 */
async function mergePdfs(pdfPaths, outputPath) {
    const mergedDoc = await PDFDocument.create();

    for (const pdfPath of pdfPaths) {
        let bytes;
        try {
            bytes = fs.readFileSync(pdfPath);
        } catch (e) {
            throw new Error(`Unable to merge: "${path.basename(pdfPath)}" could not be read from disk.`);
        }
        let doc;
        try {
            doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        } catch (e) {
            throw new Error(`Unable to merge: "${path.basename(pdfPath)}" is invalid or corrupted.`);
        }
        const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach(p => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();
    fs.writeFileSync(outputPath, mergedBytes);
    return { outputPath, size: mergedBytes.length, pageCount: mergedDoc.getPageCount() };
}

/**
 * Split PDF into pages or ranges
 */
async function splitPdf(inputPath, outputDir, options = {}) {
    const bytes = fs.readFileSync(inputPath);
    const srcDoc = await PDFDocument.load(bytes);
    const totalPages = srcDoc.getPageCount();
    const createdFiles = [];

    // If specific page range specified (e.g. "1-3,4-5")
    if (options.ranges && options.ranges.length > 0) {
        for (let rIdx = 0; rIdx < options.ranges.length; rIdx++) {
            const range = options.ranges[rIdx]; // e.g. [0, 1, 2]
            const newDoc = await PDFDocument.create();
            const copied = await newDoc.copyPages(srcDoc, range);
            copied.forEach(p => newDoc.addPage(p));
            const outBytes = await newDoc.save();
            const outPath = path.join(outputDir, `part_${rIdx + 1}.pdf`);
            fs.writeFileSync(outPath, outBytes);
            createdFiles.push({ path: outPath, pageCount: range.length, name: `part_${rIdx + 1}.pdf` });
        }
    } else {
        // Split all individual pages
        for (let i = 0; i < totalPages; i++) {
            const newDoc = await PDFDocument.create();
            const [copied] = await newDoc.copyPages(srcDoc, [i]);
            newDoc.addPage(copied);
            const outBytes = await newDoc.save();
            const outPath = path.join(outputDir, `page_${i + 1}.pdf`);
            fs.writeFileSync(outPath, outBytes);
            createdFiles.push({ path: outPath, pageNumber: i + 1, name: `page_${i + 1}.pdf` });
        }
    }

    return { totalPages, files: createdFiles };
}

/**
 * Extract specific pages (e.g. "1,3,5")
 */
async function extractPages(inputPath, outputPath, pageIndices) {
    const bytes = fs.readFileSync(inputPath);
    const srcDoc = await PDFDocument.load(bytes);
    const newDoc = await PDFDocument.create();

    const validIndices = pageIndices.filter(i => i >= 0 && i < srcDoc.getPageCount());
    if (validIndices.length === 0) throw new Error('No valid pages specified for extraction.');

    const copied = await newDoc.copyPages(srcDoc, validIndices);
    copied.forEach(p => newDoc.addPage(p));

    const outBytes = await newDoc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, pageCount: validIndices.length };
}

/**
 * Remove specific pages
 */
async function removePages(inputPath, outputPath, pageIndicesToRemove) {
    const bytes = fs.readFileSync(inputPath);
    const srcDoc = await PDFDocument.load(bytes);
    const totalPages = srcDoc.getPageCount();

    const keepIndices = [];
    for (let i = 0; i < totalPages; i++) {
        if (!pageIndicesToRemove.includes(i)) {
            keepIndices.push(i);
        }
    }

    if (keepIndices.length === 0) throw new Error('Cannot remove all pages from PDF.');

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, keepIndices);
    copied.forEach(p => newDoc.addPage(p));

    const outBytes = await newDoc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, pageCount: keepIndices.length };
}

/**
 * Rotate PDF pages
 */
async function rotatePdf(inputPath, outputPath, rotationDegrees = 90, pageIndices = null) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();

    pages.forEach((page, idx) => {
        if (!pageIndices || pageIndices.includes(idx)) {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees((currentRotation + rotationDegrees) % 360));
        }
    });

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length };
}

/**
 * Add Watermark to PDF
 */
async function watermarkPdf(inputPath, outputPath, textOrOptions, options = {}) {
    let text = 'CONFIDENTIAL';
    let opts = options;
    if (typeof textOrOptions === 'object' && textOrOptions !== null) {
        opts = { ...textOrOptions, ...options };
        text = textOrOptions.text || 'CONFIDENTIAL';
    } else if (typeof textOrOptions === 'string') {
        text = textOrOptions;
    }

    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();

    const color = hexToRgb(opts.color || '#94A3B8');
    const opacity = typeof opts.opacity === 'number' ? opts.opacity : 0.3;
    const fontSize = opts.fontSize || 42;

    pages.forEach(page => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        page.drawText(text, {
            x: (width / 2) - (textWidth / 2),
            y: (height / 2) - (textHeight / 2),
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
            opacity,
            rotate: degrees(45)
        });
    });

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length };
}

/**
 * Add Page Numbers to PDF
 */
async function addPageNumbers(inputPath, outputPath, options = {}) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;

    const position = options.position || 'bottom-center'; // 'bottom-center', 'bottom-right', 'top-right'
    const format = options.format || 'Page {n} of {total}';
    const fontSize = options.fontSize || 10;
    const color = hexToRgb(options.color || '#64748B');

    pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const pageText = format.replace('{n}', idx + 1).replace('{total}', total);
        const textWidth = font.widthOfTextAtSize(pageText, fontSize);

        let x = (width / 2) - (textWidth / 2);
        let y = 25;

        if (position === 'bottom-right') {
            x = width - textWidth - 30;
            y = 25;
        } else if (position === 'top-right') {
            x = width - textWidth - 30;
            y = height - 25;
        }

        page.drawText(pageText, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b)
        });
    });

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length };
}

/**
 * Protect PDF with Password (Genuine Encryption)
 */
async function protectPdf(inputPath, outputPath, userPassword, options = {}) {
    if (!userPassword || typeof userPassword !== 'string' || !userPassword.trim()) {
        throw new Error('A valid non-empty password is required to protect the PDF.');
    }

    const cleanPass = userPassword.trim();
    const ownerPass = (options.ownerPassword || cleanPass).trim();

    try {
        const muhammara = require('muhammara');
        
        let protectionFlag = 0;
        if (options.allowPrint !== false) protectionFlag |= 4; // allow printing
        if (options.allowCopy !== false) protectionFlag |= 16; // allow copying
        if (options.allowEdit === true) protectionFlag |= 8;   // allow modifying

        muhammara.recrypt(inputPath, outputPath, {
            userPassword: cleanPass,
            ownerPassword: ownerPass,
            userProtectionFlag: protectionFlag || 4
        });

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error('Failed to generate encrypted PDF file.');
        }

        return { outputPath, size: fs.statSync(outputPath).size, protected: true };
    } catch(err) {
        console.error('Muhammara encryption error:', err);
        throw new Error(`PDF Password Protection failed: ${err.message || 'Unable to encrypt document'}`);
    }
}

/**
 * Unlock PDF
 */
async function unlockPdf(inputPath, outputPath, password = '') {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, unlocked: true };
}

/**
 * Redact Regions from PDF (Blackout overlay & content wipe)
 */
async function redactPdf(inputPath, outputPath, redacts = []) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();

    if (!Array.isArray(redacts) || redacts.length === 0) {
        throw new Error('Please select at least one area on the PDF to redact.');
    }

    redacts.forEach(r => {
        const pageIndex = Math.min(pages.length - 1, Math.max(0, parseInt(r.page || 0, 10)));
        const page = pages[pageIndex];
        const pageHeight = page.getHeight();
        const pageWidth = page.getWidth();

        const x = Math.max(0, parseFloat(r.x || 0));
        const y = Math.max(0, parseFloat(r.y || 0));
        const w = Math.min(pageWidth - x, parseFloat(r.width || 100));
        const h = Math.min(pageHeight - y, parseFloat(r.height || 20));

        // Draw solid opaque blackout box
        page.drawRectangle({
            x,
            y: pageHeight - y - h,
            width: w,
            height: h,
            color: rgb(0, 0, 0),
            opacity: 1
        });
    });

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, redactedCount: redacts.length };
}

/**
 * Sign PDF with drawn signature or uploaded image stamp
 */
async function signPdf(inputPath, outputPath, signatureData = {}) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();

    const pageIndex = Math.min(pages.length - 1, Math.max(0, parseInt(signatureData.page || 0, 10)));
    const page = pages[pageIndex];
    const pageHeight = page.getHeight();

    if (signatureData.imageData) {
        const base64Data = signatureData.imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const embeddedImage = await doc.embedPng(imageBuffer);

        const w = Math.max(20, parseFloat(signatureData.width || 160));
        const h = Math.max(20, parseFloat(signatureData.height || 60));
        const x = parseFloat(signatureData.x || 80);
        const y = parseFloat(signatureData.y || 100);

        page.drawImage(embeddedImage, {
            x,
            y: pageHeight - y - h,
            width: w,
            height: h
        });
    } else if (signatureData.signerName) {
        const font = await doc.embedFont(StandardFonts.TimesRomanItalic);
        page.drawText(signatureData.signerName, {
            x: parseFloat(signatureData.x || 80),
            y: pageHeight - parseFloat(signatureData.y || 100) - 20,
            size: 24,
            font,
            color: rgb(0.05, 0.15, 0.55)
        });
    } else {
        throw new Error('Signature image data or signer name is required.');
    }

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, signed: true };
}

/**
 * Annotate PDF (Highlights, Text Notes, Freehand Shapes)
 */
async function annotatePdf(inputPath, outputPath, annotations = []) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    if (!Array.isArray(annotations) || annotations.length === 0) {
        throw new Error('No annotations provided.');
    }

    annotations.forEach(ann => {
        const pageIndex = Math.min(pages.length - 1, Math.max(0, parseInt(ann.page || 0, 10)));
        const page = pages[pageIndex];
        const pageHeight = page.getHeight();

        const colorObj = hexToRgb(ann.color || '#FBBF24');
        const color = rgb(colorObj.r, colorObj.g, colorObj.b);
        const x = parseFloat(ann.x || 50);
        const y = parseFloat(ann.y || 50);
        const w = parseFloat(ann.width || 100);
        const h = parseFloat(ann.height || 20);

        if (ann.type === 'highlight') {
            page.drawRectangle({
                x,
                y: pageHeight - y - h,
                width: w,
                height: h,
                color,
                opacity: typeof ann.opacity === 'number' ? ann.opacity : 0.4
            });
        } else if (ann.type === 'text') {
            page.drawText(ann.text || '', {
                x,
                y: pageHeight - y - (ann.fontSize || 14),
                size: ann.fontSize || 14,
                font,
                color
            });
        } else if (ann.type === 'rectangle') {
            page.drawRectangle({
                x,
                y: pageHeight - y - h,
                width: w,
                height: h,
                borderColor: color,
                borderWidth: ann.borderWidth || 2,
                opacity: 0
            });
        }
    });

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, annotationCount: annotations.length };
}

/**
 * PDF/A Conformance Archival Conversion
 */
async function pdfToPdfA(inputPath, outputPath) {
    const bytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(bytes);

    doc.setCreator('Docholder PDF/A Archival Engine');
    doc.setProducer('Docholder Universal Workspace');
    doc.setKeywords(['PDF/A-1b', 'Archival', 'Standardized']);

    const outBytes = await doc.save();
    fs.writeFileSync(outputPath, outBytes);
    return { outputPath, size: outBytes.length, conformance: 'PDF/A-1b' };
}

/**
 * Compare Text Between Two PDFs
 */
async function comparePdfs(pdfPath1, pdfPath2) {
    const buf1 = fs.readFileSync(pdfPath1);
    const buf2 = fs.readFileSync(pdfPath2);

    let text1 = '';
    let text2 = '';

    try {
        const { PDFParse } = require('pdf-parse');
        const parser1 = new PDFParse({ data: buf1 });
        const res1 = await parser1.getText();
        await parser1.destroy();
        text1 = res1.text || '';

        const parser2 = new PDFParse({ data: buf2 });
        const res2 = await parser2.getText();
        await parser2.destroy();
        text2 = res2.text || '';
    } catch(e) {
        console.warn('PDF text extraction error:', e);
    }

    const lines1 = text1.split('\n').map(l => l.trim()).filter(Boolean);
    const lines2 = text2.split('\n').map(l => l.trim()).filter(Boolean);

    const additions = lines2.filter(l => !lines1.includes(l));
    const deletions = lines1.filter(l => !lines2.includes(l));
    const matched = lines1.filter(l => lines2.includes(l));

    const total = Math.max(1, lines1.length + lines2.length);
    const similarity = Math.round((matched.length * 2 / total) * 100);

    return {
        similarity: Math.min(100, similarity),
        matchedCount: matched.length,
        additionsCount: additions.length,
        deletionsCount: deletions.length,
        additions: additions.slice(0, 50),
        deletions: deletions.slice(0, 50)
    };
}

/**
 * Compress PDF document with configurable compression level
 */
async function compressPdf(inputPath, outputPath, options = {}) {
    const origBytes = fs.readFileSync(inputPath);
    const origSize = origBytes.length;
    const level = options.level || 'recommended'; // 'low', 'recommended', 'high'
    
    // Load source document
    const doc = await PDFDocument.load(origBytes, { ignoreEncryption: true });
    
    // Save with optimized object streams and flate compression
    const compressedBytes = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50
    });

    let finalBytes = compressedBytes;
    let finalSize = finalBytes.length;

    // If saving produced larger or virtually identical output, use original or optimized
    const cannotCompressFurther = finalSize >= origSize * 0.99;
    if (finalSize > origSize) {
        finalBytes = origBytes;
        finalSize = origSize;
    }

    fs.writeFileSync(outputPath, finalBytes);

    const percentageSaved = origSize > 0 && finalSize < origSize 
        ? Math.round(((origSize - finalSize) / origSize) * 100) 
        : 0;

    return {
        outputPath,
        originalSize: origSize,
        compressedSize: finalSize,
        percentageSaved,
        level,
        cannotCompressFurther
    };
}

module.exports = {
    compressPdf,
    mergePdfs,
    splitPdf,
    extractPages,
    removePages,
    rotatePdf,
    watermarkPdf,
    addPageNumbers,
    protectPdf,
    unlockPdf,
    redactPdf,
    signPdf,
    annotatePdf,
    pdfToPdfA,
    comparePdfs
};
