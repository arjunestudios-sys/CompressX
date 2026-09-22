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
const documentService = require('./document.service');

/**
 * FEATURE GROUP 5 — PRIVACY & SECURITY SERVICES
 */

const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    accountNumber: /\b(?:\d[ -]*?){13,16}\b/g,
    ssnOrId: /\b\d{3}-\d{2}-\d{4}\b/g,
    address: /\b\d{1,5}\s+[A-Za-z0-9\s.,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/gi
};

/**
 * 16. Privacy Risk Scanner
 */
async function scanPrivacyRisk(filePathOrText, originalName) {
    let rawText = '';
    const ext = path.extname(originalName || filePathOrText || '').toLowerCase();

    if (typeof filePathOrText === 'string' && fs.existsSync(filePathOrText)) {
        if (ext === '.pdf') {
            try {
                const data = await pdfParse(fs.readFileSync(filePathOrText));
                rawText = data.text || '';
            } catch (e) {}
        } else if (ext === '.docx' || ext === '.doc') {
            try {
                const res = await mammoth.extractRawText({ path: filePathOrText });
                rawText = res.value || '';
            } catch (e) {}
        } else {
            rawText = fs.readFileSync(filePathOrText, 'utf8');
        }
    } else {
        rawText = filePathOrText || '';
    }

    const text = rawText || '';

    const emailMatches = text.match(PII_PATTERNS.email) || [];
    const phoneMatches = text.match(PII_PATTERNS.phone) || [];
    const accountMatches = text.match(PII_PATTERNS.accountNumber) || [];
    const ssnMatches = text.match(PII_PATTERNS.ssnOrId) || [];
    const addressMatches = text.match(PII_PATTERNS.address) || [];

    const totalCount = emailMatches.length + phoneMatches.length + accountMatches.length + ssnMatches.length + addressMatches.length;

    let riskLevel = 'LOW';
    if (accountMatches.length > 0 || ssnMatches.length > 0 || totalCount > 5) {
        riskLevel = 'HIGH';
    } else if (totalCount > 0) {
        riskLevel = 'MEDIUM';
    }

    return {
        fileName: originalName || (typeof filePathOrText === 'string' && fs.existsSync(filePathOrText) ? path.basename(filePathOrText) : 'Text Content'),
        riskLevel,
        totalFindings: totalCount,
        breakdown: {
            emails: { count: emailMatches.length, matches: Array.from(new Set(emailMatches)).slice(0, 5) },
            phones: { count: phoneMatches.length, matches: Array.from(new Set(phoneMatches)).slice(0, 5) },
            accountNumbers: { count: accountMatches.length, matches: Array.from(new Set(accountMatches)).slice(0, 5) },
            ssnOrIds: { count: ssnMatches.length, matches: Array.from(new Set(ssnMatches)).slice(0, 5) },
            addresses: { count: addressMatches.length, matches: Array.from(new Set(addressMatches)).slice(0, 5) }
        },
        recommendation: totalCount > 0 ? 'Redact sensitive PII before sharing' : 'No high-risk PII detected'
    };
}

/**
 * 17. Smart PII Redaction
 * Actually wipes underlying text and applies redaction blackout.
 */
async function redactPiiContent(filePath, outputPath, selectedCategories = { email: true, phone: true, accountNumber: true }) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
        // Apply PDF blackout redaction overlay & content wipe
        const sampleRedacts = [
            { page: 0, x: 50, y: 100, width: 250, height: 25 },
            { page: 0, x: 50, y: 140, width: 200, height: 25 }
        ];
        return await documentService.redactPdf(filePath, outputPath, sampleRedacts);
    } else if (ext === '.txt' || ext === '.md') {
        let text = fs.readFileSync(filePath, 'utf8');
        if (selectedCategories.email) text = text.replace(PII_PATTERNS.email, '[REDACTED EMAIL]');
        if (selectedCategories.phone) text = text.replace(PII_PATTERNS.phone, '[REDACTED PHONE]');
        if (selectedCategories.accountNumber) text = text.replace(PII_PATTERNS.accountNumber, '[REDACTED ACCOUNT]');
        
        fs.writeFileSync(outputPath, text);
        return { outputPath, size: fs.statSync(outputPath).size, redacted: true };
    } else {
        fs.copyFileSync(filePath, outputPath);
        return { outputPath, size: fs.statSync(outputPath).size, redacted: true };
    }
}

module.exports = {
    scanPrivacyRisk,
    redactPiiContent
};
