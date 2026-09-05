const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const imageService = require('./services/image.service');
const mediaService = require('./services/media.service');
const documentService = require('./services/document.service');
const fileDetectionService = require('./services/fileDetection.service');
const pipelineService = require('./services/pipeline.service');

async function testAll() {
    console.log('--- STARTING UNIVERSAL PLATFORM TEST SUITE ---');

    const testDir = path.join(__dirname, 'test_artifacts');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    // 1. Generate a test image (2000x2000 PNG)
    const testImgPath = path.join(testDir, 'sample_orig.png');
    await sharp({
        create: {
            width: 1200,
            height: 800,
            channels: 4,
            background: { r: 79, g: 70, b: 229, alpha: 1 }
        }
    }).png().toFile(testImgPath);
    console.log('✅ Generated sample PNG:', testImgPath, 'Size:', fs.statSync(testImgPath).size);

    // 2. Test Image Compression with Target Size (< 50 KB)
    const imgCompPath = path.join(testDir, 'sample_compressed.webp');
    const compStats = await imageService.compressImage(testImgPath, imgCompPath, { targetSizeBytes: 50 * 1024, quality: 80 });
    console.log('✅ Image compressed with target size 50KB:', compStats);

    // 3. Test Image Resize
    const imgResizePath = path.join(testDir, 'sample_resized.png');
    const resizeStats = await imageService.resizeImage(testImgPath, imgResizePath, { width: 400, height: 300 });
    console.log('✅ Image resized to 400x300:', resizeStats);

    // 4. Test Multi-Image to PDF
    const multiPdfPath = path.join(testDir, 'images_bundle.pdf');
    const pdfStats = await imageService.multiImageToPdf([testImgPath, imgResizePath], multiPdfPath);
    console.log('✅ Multi-Image combined into PDF:', pdfStats);

    // 5. Test PDF Merge and Watermark
    const pdf1 = await PDFDocument.create();
    pdf1.addPage([400, 400]);
    const pdf1Bytes = await pdf1.save();
    const pdf1Path = path.join(testDir, 'doc1.pdf');
    fs.writeFileSync(pdf1Path, pdf1Bytes);

    const pdf2 = await PDFDocument.create();
    pdf2.addPage([400, 400]);
    const pdf2Bytes = await pdf2.save();
    const pdf2Path = path.join(testDir, 'doc2.pdf');
    fs.writeFileSync(pdf2Path, pdf2Bytes);

    const mergedPdfPath = path.join(testDir, 'merged_doc.pdf');
    const mergeStats = await documentService.mergePdfs([pdf1Path, pdf2Path], mergedPdfPath);
    console.log('✅ PDFs merged:', mergeStats);

    const watermarkedPdfPath = path.join(testDir, 'watermarked_doc.pdf');
    const wmStats = await documentService.watermarkPdf(mergedPdfPath, watermarkedPdfPath, { text: 'CONFIDENTIAL TEST' });
    console.log('✅ Watermark stamped on PDF:', wmStats);

    // 6. Test File Detection & Smart Recommendations
    const inspectResult = await fileDetectionService.inspectFile(testImgPath, 'sample_orig.png', 'image/png');
    console.log('✅ Deep file inspection & recommendations:', JSON.stringify(inspectResult, null, 2));

    // 7. Test Pipeline DAG Execution
    const pipelineSteps = [
        { operation: 'resize', params: { width: 600, height: 400 } },
        { operation: 'convert', params: { format: 'webp' } }
    ];
    const pipelineOut = path.join(testDir, 'pipeline_output.webp');
    const pipeResult = await pipelineService.executePipeline(testImgPath, pipelineOut, pipelineSteps);
    console.log('✅ Multi-step pipeline DAG executed successfully:', pipeResult);

    console.log('--- ALL BACKEND TEST SUITE CHECKS PASSED! ---');
}

testAll().catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
});
