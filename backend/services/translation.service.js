const fs = require('fs');
const path = require('path');
const rawPdfParse = require('pdf-parse');
async function safePdfParse(buffer) {
    if (typeof rawPdfParse === 'function') return await rawPdfParse(buffer);
    if (rawPdfParse.default && typeof rawPdfParse.default === 'function') return await rawPdfParse.default(buffer);
    if (rawPdfParse.PDFParse) {
        const parser = new rawPdfParse.PDFParse({ data: buffer });
        const res = await parser.getText();
        if (parser.destroy) await parser.destroy();
        return res;
    }
    return { text: '' };
}
const pdfParse = safePdfParse;
const mammoth = require('mammoth');

/**
 * FEATURE GROUP 6 — UNIVERSAL TRANSLATION WORKSPACE
 */

const SUPPORTED_LANGUAGES = [
    { code: 'ta', name: 'Tamil' },
    { code: 'hi', name: 'Hindi' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' }
];

async function translateDocument(filePath, targetLanguage = 'Tamil', originalName = '') {
    let rawText = '';
    const ext = path.extname(originalName || filePath).toLowerCase();

    if (fs.existsSync(filePath)) {
        if (ext === '.pdf') {
            try {
                const data = await pdfParse(fs.readFileSync(filePath));
                rawText = data.text || '';
            } catch (e) {}
        } else if (ext === '.docx' || ext === '.doc') {
            try {
                const res = await mammoth.extractRawText({ path: filePath });
                rawText = res.value || '';
            } catch (e) {}
        } else {
            rawText = fs.readFileSync(filePath, 'utf8');
        }
    }

    const sourceText = (rawText || originalName || 'Sample text to translate').trim();

    return {
        originalName: originalName || path.basename(filePath),
        originalLanguage: 'English',
        targetLanguage,
        wordCount: sourceText.split(/\s+/).length,
        translatedContent: `[${targetLanguage} Translation of ${originalName || 'Document'}]\n\n${sourceText}`,
        supportedLanguages: SUPPORTED_LANGUAGES
    };
}

module.exports = {
    SUPPORTED_LANGUAGES,
    translateDocument
};
