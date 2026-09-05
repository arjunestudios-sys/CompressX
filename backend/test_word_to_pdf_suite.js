const fs = require('fs');
const path = require('path');
const wordToPdfService = require('./services/wordToPdf.service');

async function runSuite() {
    console.log('=== WORD TO PDF COMPREHENSIVE TEST SUITE ===');
    const outDir = path.join(__dirname, 'test_output', 'word_suite');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1. Small Word file
    console.log('\n[1/4] Testing Small Word File (~8KB)...');
    const smallPath = path.join(__dirname, 'test_artifacts', 'transcript_export.docx');
    const smallOut = path.join(outDir, 'small_out.pdf');
    const smallRes = await wordToPdfService.convertWordToPdf(smallPath, smallOut, 'Small Document');
    console.log(`✅ Small Word File converted: ${smallRes.pageCount} page(s), ${smallRes.size} bytes`);

    // 2. Medium Word file
    console.log('\n[2/4] Testing Medium Word File (~8.5KB)...');
    const medPath = path.join(__dirname, 'test_output', 'test_word.docx');
    const medOut = path.join(outDir, 'med_out.pdf');
    const medRes = await wordToPdfService.convertWordToPdf(medPath, medOut, 'Medium Document');
    console.log(`✅ Medium Word File converted: ${medRes.pageCount} page(s), ${medRes.size} bytes`);

    // 3. Large Word file with 8 embedded images
    console.log('\n[3/4] Testing Large Word File with Embedded Images (271KB)...');
    const largePath = path.join(__dirname, 'storage', 'uploads', '1', 'd8e3a26c-bce0-4e33-bb39-d53fef74290c.docx');
    const largeOut = path.join(outDir, 'large_out.pdf');
    const largeRes = await wordToPdfService.convertWordToPdf(largePath, largeOut, 'Large Document with Images');
    console.log(`✅ Large Word File converted: ${largeRes.pageCount} page(s), ${largeRes.size} bytes, ${largeRes.imageCount} image(s) embedded`);

    // 4. Legacy .doc test
    console.log('\n[4/4] Testing Legacy .doc format...');
    const docPath = path.join(outDir, 'legacy_test.doc');
    fs.writeFileSync(docPath, '\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1' + 'This is a test legacy Microsoft Word 97-2003 binary document content for Docholder verification.');
    const docOut = path.join(outDir, 'legacy_out.pdf');
    const docRes = await wordToPdfService.convertWordToPdf(docPath, docOut, 'Legacy Word Document');
    console.log(`✅ Legacy .doc converted: ${docRes.pageCount} page(s), ${docRes.size} bytes`);

    console.log('\n🎉 ALL 4 WORD TO PDF CONVERSION TESTS PASSED 100%!');
}

runSuite().catch(err => {
    console.error('❌ Word to PDF Suite Failed:', err);
    process.exit(1);
});
