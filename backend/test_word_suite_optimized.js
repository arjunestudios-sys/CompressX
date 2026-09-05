/**
 * Comprehensive Automated Test Suite for Optimized Word Processing Suite
 */

const fs = require('fs');
const path = require('path');
const docx = require('docx');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const wordToPdfService = require('./services/wordToPdf.service');
const docxOptimizerService = require('./services/docxOptimizer.service');

const testDir = path.join(__dirname, 'test_artifacts');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

async function runWordSuite() {
    console.log('===========================================================');
    console.log('    DOCHOLDER WORD PROCESSING OPTIMIZATION TEST SUITE      ');
    console.log('===========================================================\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        process.stdout.write(`• Testing: ${name}... `);
        try {
            await fn();
            console.log('✓ PASSED');
            passed++;
        } catch(err) {
            console.log(`✗ FAILED: ${err.message}`);
            console.error(err);
            failed++;
        }
    }

    // 1. Create rich sample DOCX with text and embedded images
    const sampleDocxPath = path.join(testDir, 'sample_word.docx');
    const imgPath = path.join(testDir, 'word_test_img.png');

    // Create test image
    await sharp({
        create: { width: 1200, height: 800, channels: 3, background: { r: 60, g: 120, b: 240 } }
    }).png().toFile(imgPath);

    const doc = new docx.Document({
        sections: [{
            children: [
                new docx.Paragraph({
                    heading: docx.HeadingLevel.HEADING_1,
                    children: [new docx.TextRun({ text: 'Docholder Word Processing Suite', bold: true, size: 32 })]
                }),
                new docx.Paragraph({
                    heading: docx.HeadingLevel.HEADING_2,
                    children: [new docx.TextRun({ text: 'High-Fidelity Document Architecture', bold: true, size: 24 })]
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({ text: 'This document tests native Word typography, styling presets, embedded images, and compression algorithms. ' }),
                        new docx.TextRun({ text: 'Bold and italic segments are accurately extracted and rendered.', bold: true, italics: true })
                    ]
                }),
                new docx.Paragraph({
                    children: [
                        new docx.ImageRun({
                            data: fs.readFileSync(imgPath),
                            transformation: { width: 300, height: 200 }
                        })
                    ]
                })
            ]
        }]
    });

    const buffer = await docx.Packer.toBuffer(doc);
    fs.writeFileSync(sampleDocxPath, buffer);

    // TEST 1: Standard Word to PDF conversion
    await test('Word to PDF - Standard A4 conversion', async () => {
        const outPdf = path.join(testDir, 'word_standard.pdf');
        const res = await wordToPdfService.convertWordToPdf(sampleDocxPath, outPdf, 'Docholder Document', {
            pageSize: 'A4',
            margins: 'standard',
            theme: 'modern',
            pageNumbers: true
        });

        if (!fs.existsSync(outPdf) || res.pageCount === 0) {
            throw new Error('Word to PDF failed to create output file.');
        }

        const pdfDoc = await PDFDocument.load(fs.readFileSync(outPdf));
        if (pdfDoc.getPageCount() < 1) {
            throw new Error('Generated PDF has 0 pages.');
        }
    });

    // TEST 2: Word to PDF with Custom Options (US Letter, Classic Theme, Watermark)
    await test('Word to PDF - US Letter, Classic Theme & Watermark', async () => {
        const outPdf = path.join(testDir, 'word_classic_watermark.pdf');
        const res = await wordToPdfService.convertWordToPdf(sampleDocxPath, outPdf, 'Watermarked Document', {
            pageSize: 'Letter',
            margins: 'compact',
            theme: 'classic',
            watermark: 'CONFIDENTIAL',
            pageNumbers: true
        });

        if (!fs.existsSync(outPdf)) {
            throw new Error('Watermarked PDF was not created.');
        }

        const pdfDoc = await PDFDocument.load(fs.readFileSync(outPdf));
        const page = pdfDoc.getPage(0);
        // Letter dimensions: 612 x 792
        if (Math.abs(page.getWidth() - 612) > 2 || Math.abs(page.getHeight() - 792) > 2) {
            throw new Error(`Expected Letter page size, got: ${page.getWidth()}x${page.getHeight()}`);
        }
    });

    // TEST 3: DOCX Optimization & Media Compression
    await test('DOCX Optimization & Media Streamlining', async () => {
        const outDocx = path.join(testDir, 'word_optimized.docx');
        const res = await docxOptimizerService.optimizeDocx(sampleDocxPath, outDocx, { level: 'high' });

        if (!fs.existsSync(outDocx) || res.optimizedSize === 0) {
            throw new Error('Optimized DOCX output not found.');
        }

        if (typeof res.originalSize !== 'number' || typeof res.optimizedSize !== 'number') {
            throw new Error('Invalid optimization result structure.');
        }

        console.log(`\n  (DOCX Size: ${res.originalSize} B → ${res.optimizedSize} B | ${res.percentageSaved}% saved | ${res.mediaOptimizedCount} images optimized)`);
    });

    // TEST 4: DOCX Save New Document without duplicate text runs
    await test('DOCX Authoring - Clean paragraph synthesis without text duplication', async () => {
        const docxController = require('./controllers/docx.controller');
        const db = require('./config/db');

        // Test user mock
        const mockUser = { id: 1 };
        let resData = null;

        const req = {
            user: mockUser,
            body: {
                title: 'Clean_Authored_Doc',
                paragraphs: [
                    { text: 'Single Line Title', heading: 1 },
                    { text: 'This text should appear exactly once in the document.', heading: 0, bold: true }
                ]
            }
        };

        const res = {
            status: () => res,
            json: (data) => { resData = data; return res; }
        };

        await docxController.saveNewDocx(req, res, (err) => { if (err) throw err; });

        if (!resData || !resData.file) {
            throw new Error('saveNewDocx did not create a file record.');
        }

        const mammoth = require('mammoth');
        const textResult = await mammoth.extractRawText({ path: resData.file.storage_path });
        const occurrences = (textResult.value.match(/This text should appear exactly once/g) || []).length;
        if (occurrences !== 1) {
            throw new Error(`Text run was duplicated ${occurrences} times instead of 1.`);
        }
    });

    console.log('\n===========================================================');
    console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===========================================================\n');

    if (failed > 0) process.exit(1);
}

runWordSuite().catch(err => {
    console.error('Word suite error:', err);
    process.exit(1);
});
