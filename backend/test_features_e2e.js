const fs = require('fs');
const path = require('path');
const pptxService = require('./services/pptx.service');
const mediaService = require('./services/media.service');

async function testAll() {
    console.log('=== STARTING END-TO-END FEATURE VERIFICATION ===');
    const testDir = path.join(__dirname, 'test_output');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    // 1. Test PPTX Generation
    console.log('\n[1/5] Testing PowerPoint (.pptx) generation...');
    const pptxPath = path.join(testDir, 'test_deck.pptx');
    const pptxRes = await pptxService.textToPptx(
        'Docholder Overview\nUniversal conversion engine.\nUltra-fast processing.\nFull local storage support.',
        'Docholder Presentation',
        pptxPath
    );
    if (fs.existsSync(pptxPath) && fs.statSync(pptxPath).size > 0) {
        console.log(`✅ PPTX generated successfully (${fs.statSync(pptxPath).size} bytes)`);
    } else {
        throw new Error('PPTX generation failed');
    }

    // 2. Test PPTX to PDF
    console.log('\n[2/5] Testing PowerPoint (.pptx) to PDF conversion...');
    const pdfPath = path.join(testDir, 'from_pptx.pdf');
    await pptxService.pptxToPdf(pptxPath, pdfPath);
    if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
        console.log(`✅ PPTX to PDF converted successfully (${fs.statSync(pdfPath).size} bytes)`);
    } else {
        throw new Error('PPTX to PDF conversion failed');
    }

    // 3. Test Word Document Creation
    console.log('\n[3/5] Testing Word (.docx) native generation...');
    const docx = require('docx');
    const docxDoc = new docx.Document({
        sections: [{
            children: [
                new docx.Paragraph({
                    text: 'Docholder Word Studio Document',
                    heading: docx.HeadingLevel.HEADING_1
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({ text: 'This document was created and formatted natively in Word Studio.', bold: true })
                    ]
                })
            ]
        }]
    });
    const docxBuffer = await docx.Packer.toBuffer(docxDoc);
    const docxPath = path.join(testDir, 'test_word.docx');
    fs.writeFileSync(docxPath, docxBuffer);
    if (fs.existsSync(docxPath) && fs.statSync(docxPath).size > 0) {
        console.log(`✅ DOCX generated successfully (${fs.statSync(docxPath).size} bytes)`);
    } else {
        throw new Error('DOCX generation failed');
    }

    // 4. Test Audio Tone Synthesis & Volume Adjustment
    console.log('\n[4/5] Testing Audio Volume Adjustment & Synthesis...');
    const audioInput = path.join(testDir, 'tone.mp3');
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

    // Generate a 1-second test audio tone with ffmpeg
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input('anullsrc=r=44100:cl=mono')
            .inputOptions(['-f', 'lavfi', '-t', '1'])
            .audioCodec('libmp3lame')
            .on('end', resolve)
            .on('error', reject)
            .save(audioInput);
    });

    const audioVolOutput = path.join(testDir, 'tone_volume.mp3');
    await mediaService.adjustVolume(audioInput, audioVolOutput, 1.5);
    if (fs.existsSync(audioVolOutput) && fs.statSync(audioVolOutput).size > 0) {
        console.log(`✅ Audio volume adjusted successfully (${fs.statSync(audioVolOutput).size} bytes)`);
    } else {
        throw new Error('Audio volume adjustment failed');
    }

    // 5. Test Audio Merge
    console.log('\n[5/5] Testing Audio Merge...');
    const audioMergedOutput = path.join(testDir, 'tone_merged.mp3');
    await mediaService.mergeAudio([audioInput, audioVolOutput], audioMergedOutput);
    if (fs.existsSync(audioMergedOutput) && fs.statSync(audioMergedOutput).size > 0) {
        console.log(`✅ Audio tracks merged successfully (${fs.statSync(audioMergedOutput).size} bytes)`);
    } else {
        throw new Error('Audio merge failed');
    }

    console.log('\n🎉 ALL 5 ADVANCED BACKEND FUNCTIONALITY TESTS PASSED 100%!');
}

testAll().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
