/**
 * Automated Verification Script for Critical Bug Fixes & Functional Enhancements
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');
const crypto = require('crypto');

const documentService = require('./services/document.service');
const imageService = require('./services/image.service');
const transcriptionService = require('./services/transcription.service');
const wordToPdfService = require('./services/wordToPdf.service');
const docxOptimizerService = require('./services/docxOptimizer.service');

const testDir = path.join(__dirname, 'test_artifacts');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

async function runCriticalTests() {
    console.log('===========================================================');
    console.log('  DOCHOLDER CRITICAL APPLICATION BUG FIXES & VERIFICATION  ');
    console.log('===========================================================\n');

    let passed = 0;
    let failed = 0;

    async function test(title, fn) {
        process.stdout.write(`• Testing: ${title}... `);
        try {
            await fn();
            console.log('✓ PASSED');
            passed++;
        } catch (err) {
            console.log(`✗ FAILED: ${err.message}`);
            console.error(err);
            failed++;
        }
    }

    // 1. Setup Test Files
    const pdf1Path = path.join(testDir, 'part1.pdf');
    const pdf2Path = path.join(testDir, 'part2.pdf');
    const pdf3Path = path.join(testDir, 'part3.pdf');
    const corruptPdfPath = path.join(testDir, 'corrupt.pdf');
    
    const img1Path = path.join(testDir, 'img1.png');
    const img2Path = path.join(testDir, 'img2.jpg');
    const img3Path = path.join(testDir, 'img3.webp');

    // Create 3 valid PDFs with identifiable page text
    for (let i = 1; i <= 3; i++) {
        const doc = await PDFDocument.create();
        const page = doc.addPage([500, 700]);
        page.drawText(`Document Part ${i} Page 1`, { x: 50, y: 650, size: 24, color: rgb(0.2, 0.4, 0.8) });
        const bytes = await doc.save();
        fs.writeFileSync(path.join(testDir, `part${i}.pdf`), bytes);
    }

    // Create corrupt PDF file
    fs.writeFileSync(corruptPdfPath, 'THIS_IS_NOT_A_VALID_PDF_HEADER_CORRUPTED_STREAM');

    // Create 3 test images
    await sharp({
        create: { width: 400, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toFile(img1Path);

    await sharp({
        create: { width: 500, height: 400, channels: 3, background: { r: 0, g: 255, b: 0 } }
    }).jpeg().toFile(img2Path);

    await sharp({
        create: { width: 600, height: 500, channels: 3, background: { r: 0, g: 0, b: 255 } }
    }).webp().toFile(img3Path);

    // TEST 1: PDF Compress (All 3 levels)
    await test('PDF Compress - Standard, Recommended, and Maximum levels', async () => {
        const outLow = path.join(testDir, 'compressed_low.pdf');
        const outRec = path.join(testDir, 'compressed_rec.pdf');
        const outHigh = path.join(testDir, 'compressed_high.pdf');

        const resLow = await documentService.compressPdf(pdf1Path, outLow, { level: 'low', imageQuality: 85 });
        const resRec = await documentService.compressPdf(pdf1Path, outRec, { level: 'recommended', imageQuality: 65 });
        const resHigh = await documentService.compressPdf(pdf1Path, outHigh, { level: 'high', imageQuality: 40 });

        if (!fs.existsSync(outLow) || !fs.existsSync(outRec) || !fs.existsSync(outHigh)) {
            throw new Error('Compressed PDF files not created on disk.');
        }
        if (typeof resLow.originalSize !== 'number' || typeof resLow.compressedSize !== 'number') {
            throw new Error('Invalid compression response structure.');
        }
    });

    // TEST 2: PDF Merge - Sequential ordering preservation
    await test('PDF Merge - Order preservation across 3 documents', async () => {
        const mergedOut = path.join(testDir, 'merged_ordered.pdf');
        // Order: part3, part1, part2
        const res = await documentService.mergePdfs([pdf3Path, pdf1Path, pdf2Path], mergedOut);

        if (!fs.existsSync(mergedOut) || res.pageCount !== 3) {
            throw new Error(`Expected 3 pages in merged PDF, got ${res.pageCount}`);
        }

        const doc = await PDFDocument.load(fs.readFileSync(mergedOut));
        if (doc.getPageCount() !== 3) {
            throw new Error(`Loaded PDF page count mismatch: ${doc.getPageCount()}`);
        }
    });

    // TEST 3: PDF Merge - Corruption Validation with descriptive message
    await test('PDF Merge - Descriptive error on invalid/corrupted file', async () => {
        const mergedOut = path.join(testDir, 'merged_fail.pdf');
        let errorCaught = false;

        try {
            await documentService.mergePdfs([pdf1Path, corruptPdfPath, pdf2Path], mergedOut);
        } catch (err) {
            errorCaught = true;
            if (!err.message.includes('Unable to merge') || !err.message.includes('corrupt.pdf')) {
                throw new Error(`Error message does not identify corrupted file specifically: "${err.message}"`);
            }
        }

        if (!errorCaught) {
            throw new Error('Merging with a corrupted file did not throw an error!');
        }
    });

    // TEST 4: Multi-Image to PDF - Order & Layout options
    await test('Multi-Image to PDF - Order preservation and A4 layout', async () => {
        const outPdf = path.join(testDir, 'multi_images_a4.pdf');
        // Sequence: img3 (blue), img1 (red), img2 (green)
        const res = await imageService.imagesToPdf([img3Path, img1Path, img2Path], outPdf, {
            pageSize: 'A4',
            orientation: 'portrait',
            fit: 'contain',
            quality: 85
        });

        if (!fs.existsSync(outPdf) || res.pageCount !== 3) {
            throw new Error(`Expected 3 pages in multi-image PDF, got ${res.pageCount}`);
        }

        const doc = await PDFDocument.load(fs.readFileSync(outPdf));
        const firstPage = doc.getPage(0);
        if (Math.abs(firstPage.getWidth() - 595.28) > 2 || Math.abs(firstPage.getHeight() - 841.89) > 2) {
            throw new Error(`Unexpected page dimensions for A4: ${firstPage.getWidth()}x${firstPage.getHeight()}`);
        }
    });

    // TEST 5: Image to PDF (Single) with Auto layout
    await test('Single Image to PDF - Auto sizing layout', async () => {
        const outPdf = path.join(testDir, 'single_img_auto.pdf');
        const res = await imageService.convertImage(img1Path, outPdf, 'pdf', {
            pageSize: 'auto'
        });

        if (!fs.existsSync(outPdf)) {
            throw new Error('Single image to PDF output not found.');
        }

        const doc = await PDFDocument.load(fs.readFileSync(outPdf));
        const page = doc.getPage(0);
        if (page.getWidth() !== 400 || page.getHeight() !== 300) {
            throw new Error(`Page dimension mismatch: expected 400x300, got ${page.getWidth()}x${page.getHeight()}`);
        }
    });

    // TEST 6: Audio Transcription Studio - Export TXT and DOCX
    await test('Audio Transcription - Export formatting TXT & DOCX generation', async () => {
        const dummyAudio = path.join(testDir, 'dummy_audio.wav');
        const wavHeader = Buffer.alloc(44);
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36, 4);
        wavHeader.write('WAVE', 8);
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16);
        wavHeader.writeUInt16LE(1, 20); // PCM
        wavHeader.writeUInt16LE(1, 22); // mono
        wavHeader.writeUInt32LE(16000, 24);
        wavHeader.writeUInt32LE(32000, 28);
        wavHeader.writeUInt16LE(2, 32);
        wavHeader.writeUInt16LE(16, 34);
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(0, 40);
        fs.writeFileSync(dummyAudio, wavHeader);

        const transResult = await transcriptionService.transcribeAudio(dummyAudio, { language: 'en' });
        if (!transResult.transcriptText || transResult.transcriptText.length === 0) {
            throw new Error('Transcription service returned empty text.');
        }

        const docxOut = path.join(testDir, 'transcript_export.docx');
        const docxResult = await transcriptionService.exportTranscript(transResult.transcriptText, 'Audio Transcript', 'docx', docxOut);
        if (!fs.existsSync(docxOut) || docxResult.size === 0) {
            throw new Error('Transcript DOCX export failed.');
        }
    });

    // TEST 7: Word Processing - Word to PDF with custom styling options & DOCX optimization
    await test('Word Processing Suite - Styling options & DOCX optimization', async () => {
        const docx = require('docx');
        const sampleDocx = path.join(testDir, 'test_word_doc.docx');
        const outPdf = path.join(testDir, 'test_word_styled.pdf');
        const outOptDocx = path.join(testDir, 'test_word_opt.docx');

        const testDoc = new docx.Document({
            sections: [{
                children: [
                    new docx.Paragraph({
                        heading: docx.HeadingLevel.HEADING_1,
                        children: [new docx.TextRun({ text: 'Enterprise Document Overview', bold: true })]
                    }),
                    new docx.Paragraph({
                        children: [new docx.TextRun({ text: 'Docholder provides state-of-the-art document processing.' })]
                    })
                ]
            }]
        });

        const buf = await docx.Packer.toBuffer(testDoc);
        fs.writeFileSync(sampleDocx, buf);

        const pdfRes = await wordToPdfService.convertWordToPdf(sampleDocx, outPdf, 'Test Document', {
            pageSize: 'A4',
            margins: 'compact',
            theme: 'modern',
            watermark: 'SAMPLE',
            pageNumbers: true
        });

        if (!fs.existsSync(outPdf) || pdfRes.pageCount === 0) {
            throw new Error('Word to styled PDF conversion failed.');
        }

        const optRes = await docxOptimizerService.optimizeDocx(sampleDocx, outOptDocx, { level: 'recommended' });
        if (!fs.existsSync(outOptDocx) || optRes.optimizedSize === 0) {
            throw new Error('DOCX optimization failed.');
        }
    });

    // TEST 8: Batch Conversion with mixed file types & isolated failure handling
    await test('Batch Conversion - Mixed multi-type assets and isolated failure resilience', async () => {
        const convertController = require('./controllers/convert.controller');
        const db = require('./config/db');

        // Test user
        const testUserId = 1;

        // Insert test file records into SQLite
        const f1 = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(testUserId, 'test1.png', 'img1.png', 'image', 'image/png', fs.statSync(img1Path).size, img1Path);

        const f2 = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(testUserId, 'test2.pdf', 'part1.pdf', 'doc', 'application/pdf', fs.statSync(pdf1Path).size, pdf1Path);

        const fCorrupt = db.prepare(`
            INSERT INTO files (user_id, original_name, stored_name, file_type, mime_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(testUserId, 'bad.pdf', 'corrupt.pdf', 'doc', 'application/pdf', fs.statSync(corruptPdfPath).size, corruptPdfPath);

        let req = {
            user: { id: testUserId },
            body: {
                fileIds: [f1.lastInsertRowid, f2.lastInsertRowid, fCorrupt.lastInsertRowid],
                format: 'pdf',
                bundleZip: true
            }
        };

        let resJson = null;
        let mockRes = {
            status: () => mockRes,
            json: (data) => {
                resJson = data;
                return mockRes;
            }
        };

        await convertController.batchConvert(req, mockRes, (err) => {
            if (err) throw err;
        });

        if (!resJson || !resJson.results) {
            throw new Error('Batch convert did not return standard response.');
        }

        if (resJson.successful < 2) {
            throw new Error(`Expected at least 2 successful conversions, got ${resJson.successful}`);
        }

        console.log(`\n  (Batch details: ${resJson.successful} successful, ${resJson.failed ? resJson.failed.length : 0} failed)`);
    });

    console.log('\n===========================================================');
    console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===========================================================\n');

    if (failed > 0) process.exit(1);
}

runCriticalTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
