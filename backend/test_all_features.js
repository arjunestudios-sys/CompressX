/**
 * Comprehensive Automated Verification Test Suite for Docholder
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');
const documentService = require('./services/document.service');
const imageService = require('./services/image.service');
const transcriptionService = require('./services/transcription.service');
const conversionRegistry = require('./services/conversionRegistry');

const testDir = path.join(__dirname, 'test_artifacts');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

async function runAllTests() {
    console.log('====================================================');
    console.log('   DOCHOLDER FULL FEATURE VERIFICATION TEST SUITE   ');
    console.log('====================================================\n');

    let passedCount = 0;
    let failedCount = 0;

    async function assertTest(name, fn) {
        try {
            process.stdout.write(`• Testing: ${name}... `);
            await fn();
            console.log('✓ PASSED');
            passedCount++;
        } catch (err) {
            console.log(`✗ FAILED: ${err.message}`);
            console.error(err);
            failedCount++;
        }
    }

    // 1. Test PDF Generation and Native Password Protection
    const dummyPdfPath = path.join(testDir, 'sample_source.pdf');
    const protectedPdfPath = path.join(testDir, 'sample_protected.pdf');
    
    await assertTest('Create baseline PDF Document', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([600, 800]);
        page.drawText('Docholder Test Document Content', { x: 50, y: 700, size: 20, color: rgb(0.1, 0.1, 0.1) });
        const bytes = await doc.save();
        fs.writeFileSync(dummyPdfPath, bytes);
        if (!fs.existsSync(dummyPdfPath) || fs.statSync(dummyPdfPath).size === 0) {
            throw new Error('Failed to create test PDF');
        }
    });

    await assertTest('PDF Protect with Muhammara Encryption & Permissions', async () => {
        const res = await documentService.protectPdf(dummyPdfPath, protectedPdfPath, 'SecurePassword123', {
            ownerPassword: 'OwnerPassword456',
            allowPrint: true,
            allowCopy: false,
            allowEdit: false
        });
        if (!fs.existsSync(res.outputPath) || res.size === 0) {
            throw new Error('Protected PDF file was not created properly.');
        }
    });

    // 2. Test PDF Sign & Annotate & Redact
    const signedPdfPath = path.join(testDir, 'sample_signed.pdf');
    await assertTest('PDF Sign with embedded signature', async () => {
        const sigPngPath = path.join(testDir, 'sig_stamp.png');
        await sharp({
            create: {
                width: 150,
                height: 50,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            }
        }).png().toFile(sigPngPath);

        const sigDataUrl = `data:image/png;base64,${fs.readFileSync(sigPngPath).toString('base64')}`;

        const res = await documentService.signPdf(dummyPdfPath, signedPdfPath, {
            imageData: sigDataUrl,
            page: 0,
            x: 100,
            y: 100,
            width: 150,
            height: 50
        });

        if (!fs.existsSync(res.outputPath)) throw new Error('Signed PDF not generated.');
    });

    const annotatedPdfPath = path.join(testDir, 'sample_annotated.pdf');
    await assertTest('PDF Annotate with highlight and note', async () => {
        const res = await documentService.annotatePdf(dummyPdfPath, annotatedPdfPath, [
            { type: 'highlight', page: 0, x: 50, y: 680, width: 300, height: 25, color: '#FBBF24', opacity: 0.4 },
            { type: 'text', page: 0, x: 50, y: 650, text: 'Approved by Auditor', color: '#10B981', fontSize: 12 }
        ]);
        if (!fs.existsSync(res.outputPath)) throw new Error('Annotated PDF not generated.');
    });

    const redactedPdfPath = path.join(testDir, 'sample_redacted.pdf');
    await assertTest('PDF Redact with permanent blackout rectangles', async () => {
        const res = await documentService.redactPdf(dummyPdfPath, redactedPdfPath, [
            { page: 0, x: 50, y: 690, width: 320, height: 30 }
        ]);
        if (!fs.existsSync(res.outputPath)) throw new Error('Redacted PDF not generated.');
    });

    // 3. Test Image Operations: Resize, Crop, Rotate & Flip, Conversion
    const sampleImgPath = path.join(testDir, 'test_image.jpg');
    await assertTest('Create baseline Image', async () => {
        await sharp({
            create: {
                width: 1200,
                height: 800,
                channels: 3,
                background: { r: 99, g: 102, b: 241 }
            }
        }).jpeg().toFile(sampleImgPath);
    });

    await assertTest('Image Resize with dimensions calculation', async () => {
        const outResizePath = path.join(testDir, 'image_resized.jpg');
        const res = await imageService.resizeImage(sampleImgPath, outResizePath, { width: 600, height: 400 });
        if (res.afterDimensions !== '600x400') {
            throw new Error(`Unexpected dimensions: ${res.afterDimensions}`);
        }
    });

    await assertTest('Image Interactive Crop', async () => {
        const outCropPath = path.join(testDir, 'image_cropped.jpg');
        const res = await imageService.cropImage(sampleImgPath, outCropPath, { left: 100, top: 100, width: 500, height: 500 });
        if (!fs.existsSync(res.outputPath)) throw new Error('Cropped image not generated.');
    });

    await assertTest('Image Custom Angle Rotation and Flip', async () => {
        const outRotPath = path.join(testDir, 'image_rotated.jpg');
        const res = await imageService.rotateFlipImage(sampleImgPath, outRotPath, { rotate: 45, flop: true });
        if (!fs.existsSync(res.outputPath)) throw new Error('Rotated image not generated.');
    });

    await assertTest('Image Format Conversion (JPG -> WebP)', async () => {
        const outWebpPath = path.join(testDir, 'image_converted.webp');
        const res = await imageService.convertImage(sampleImgPath, outWebpPath, 'webp');
        if (!fs.existsSync(res.outputPath)) throw new Error('WebP image not generated.');
    });

    // 4. Test Transcription Service & Multi-Format Export
    await assertTest('Audio Transcription Generation & Multi-Export (TXT, DOCX, PDF)', async () => {
        const dummyAudioPath = path.join(testDir, 'sample_audio.mp3');
        fs.writeFileSync(dummyAudioPath, Buffer.alloc(1024));

        const transcript = await transcriptionService.transcribeAudio(dummyAudioPath, {
            originalName: 'interview_audio.mp3',
            fileSize: 1024
        });

        if (!transcript.transcriptText || transcript.wordCount <= 0) {
            throw new Error('Transcription text generation failed.');
        }

        // Test Export to TXT
        const txtOut = path.join(testDir, 'transcript_export.txt');
        const txtExport = await transcriptionService.exportTranscript(transcript.transcriptText, 'Interview Transcript', 'txt', txtOut);
        if (!fs.existsSync(txtExport.outputPath)) throw new Error('Transcript TXT export failed.');

        // Test Export to DOCX
        const docxOut = path.join(testDir, 'transcript_export.docx');
        const docxExport = await transcriptionService.exportTranscript(transcript.transcriptText, 'Interview Transcript', 'docx', docxOut);
        if (!fs.existsSync(docxExport.outputPath)) throw new Error('Transcript DOCX export failed.');

        // Test Export to PDF
        const pdfOut = path.join(testDir, 'transcript_export.pdf');
        const pdfExport = await transcriptionService.exportTranscript(transcript.transcriptText, 'Interview Transcript', 'pdf', pdfOut);
        if (!fs.existsSync(pdfExport.outputPath)) throw new Error('Transcript PDF export failed.');
    });

    // 5. Test Format Registry Consistency
    await assertTest('Universal Format Registry Matrices', async () => {
        const docxConvs = conversionRegistry.getAvailableConversions('docx');
        if (!docxConvs.targetFormats.includes('pdf') || !docxConvs.targetFormats.includes('txt')) {
            throw new Error('DOCX target formats incomplete.');
        }

        const jpgConvs = conversionRegistry.getAvailableConversions('jpg');
        if (!jpgConvs.targetFormats.includes('webp') || !jpgConvs.targetFormats.includes('png') || !jpgConvs.targetFormats.includes('pdf')) {
            throw new Error('JPG target formats incomplete.');
        }
    });

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');

    if (failedCount > 0) process.exit(1);
}

runAllTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
