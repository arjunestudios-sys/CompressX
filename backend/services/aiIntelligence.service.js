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
const usageService = require('./usage.service');

/**
 * FEATURE GROUP 1 — AI CONTENT & WRITING INTELLIGENCE
 */

/**
 * 1. AI Content Rate Tracker
 * Analyzes text/documents for AI-like structural patterns, perplexity proxies, and phrase repetition.
 */
async function analyzeAiContent(textOrFilePath, userId = null) {
    let rawText = '';

    if (typeof textOrFilePath === 'string' && fs.existsSync(textOrFilePath)) {
        const ext = path.extname(textOrFilePath).toLowerCase();
        if (ext === '.pdf') {
            const buf = fs.readFileSync(textOrFilePath);
            const data = await pdfParse(buf);
            rawText = data.text || '';
        } else if (ext === '.docx' || ext === '.doc') {
            const result = await mammoth.extractRawText({ path: textOrFilePath });
            rawText = result.value || '';
        } else {
            rawText = fs.readFileSync(textOrFilePath, 'utf8');
        }
    } else if (typeof textOrFilePath === 'string') {
        rawText = textOrFilePath;
    }

    const text = (rawText || '').trim();
    if (!text || text.length < 20) {
        return {
            aiLikeness: 15,
            humanLikeness: 85,
            confidence: 'Low',
            signals: ['Short input text provided'],
            wordCount: text.split(/\s+/).filter(Boolean).length
        };
    }

    // Measure structural features
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Sentence length variance (AI text tends to have low variance)
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / (sentences.length || 1);
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLen, 2), 0) / (sentences.length || 1);
    const stdDev = Math.sqrt(variance);

    // Predictable transition phrases check
    const aiPhrases = [
        'furthermore', 'moreover', 'in conclusion', 'it is important to note',
        'additionally', 'delve', 'testament to', 'crucial role', 'seamlessly',
        'beacon', 'tapestry', 'transformative', 'in summary', 'consequently'
    ];
    let aiPhraseHits = 0;
    const lowerText = text.toLowerCase();
    aiPhrases.forEach(p => {
        const matches = lowerText.match(new RegExp(`\\b${p}\\b`, 'g'));
        if (matches) aiPhraseHits += matches.length;
    });

    // Uniformity & Vocabulary Diversity score
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabDiversity = uniqueWords.size / Math.max(1, wordCount);

    let aiScore = 50;

    // Lower standard deviation -> higher AI probability
    if (stdDev < 4) aiScore += 20;
    else if (stdDev > 10) aiScore -= 20;

    // Phrase count impact
    aiScore += Math.min(30, aiPhraseHits * 8);

    // Uniform word length
    if (vocabDiversity > 0.65) aiScore -= 15;
    else if (vocabDiversity < 0.45) aiScore += 15;

    // Clamp score
    const finalAiLikeness = Math.max(5, Math.min(95, Math.round(aiScore)));
    const finalHumanLikeness = 100 - finalAiLikeness;

    const confidence = wordCount > 150 ? 'High' : wordCount > 50 ? 'Medium' : 'Low';

    const detectedSignals = [];
    if (stdDev < 5) detectedSignals.push('Uniform sentence patterns & length');
    if (aiPhraseHits > 0) detectedSignals.push(`Predictable AI phrasing (${aiPhraseHits} detected signals)`);
    if (vocabDiversity < 0.5) detectedSignals.push('Unusually consistent vocabulary');
    if (finalAiLikeness > 60) detectedSignals.push('Excessive formal structure and smooth transitions');
    if (detectedSignals.length === 0) detectedSignals.push('Natural stylistic variation and human burstiness');

    // Track AI analysis usage
    if (userId) {
        try { usageService.consumeQuota(userId, 'ai_documents', 1); } catch (e) {}
    }

    return {
        aiLikeness: finalAiLikeness,
        humanLikeness: finalHumanLikeness,
        confidence,
        signals: detectedSignals,
        wordCount,
        sentenceCount: sentences.length,
        averageSentenceLength: Math.round(avgLen * 10) / 10
    };
}

/**
 * 2. Smart Humanizer With Character Limits
 * Controlled rewriting into natural human phrasing while preserving meaning and enforcing character limits.
 */
async function humanizeContent({ text, mode = 'Natural', sectionOnly = false, userId = null }) {
    if (!text || !text.trim()) {
        throw new Error('Please provide valid text to humanize.');
    }

    const charCount = text.length;

    // Enforce real character allowance
    if (userId) {
        const quotaCheck = usageService.checkQuota(userId, 'humanizer_chars', charCount);
        if (!quotaCheck.allowed) {
            const error = new Error(`Your selected content (${charCount} chars) exceeds your remaining character allowance (${quotaCheck.remaining} chars).`);
            error.statusCode = 429;
            error.quotaDetails = quotaCheck;
            throw error;
        }
    }

    // Transformation logic based on selected intensity
    let humanizedText = text;

    // Phrase replacements for humanization
    const replacements = {
        'in order to': 'to',
        'furthermore,': 'also,',
        'moreover,': 'plus,',
        'in conclusion,': 'overall,',
        'it is important to note that': 'notably,',
        'additionally,': 'and,',
        'utilize': 'use',
        'demonstrates': 'shows',
        'testament to': 'proof of',
        'seamlessly': 'easily',
        'transformative': 'major',
        'delve into': 'look into'
    };

    let processed = text;
    Object.keys(replacements).forEach(pattern => {
        const reg = new RegExp(`\\b${pattern}\\b`, 'gi');
        processed = processed.replace(reg, replacements[pattern]);
    });

    if (mode === 'Light') {
        humanizedText = processed;
    } else if (mode === 'Strong') {
        // Vary sentence structures slightly
        humanizedText = processed
            .split('. ')
            .map((s, idx) => {
                if (idx % 3 === 0 && s.startsWith('The ')) {
                    return s.replace(/^The /, 'Noticeably, the ');
                }
                return s;
            })
            .join('. ');
    } else {
        // Natural (Default)
        humanizedText = processed;
    }

    // Consume character quota after successful processing
    if (userId) {
        usageService.consumeQuota(userId, 'humanizer_chars', charCount);
    }

    const remainingQuota = userId ? usageService.getUserUsage(userId).humanizer_chars.remaining : 2000 - charCount;

    return {
        originalText: text,
        humanizedText,
        mode,
        charactersUsed: charCount,
        remainingAllowance: remainingQuota,
        beforeAfterDiff: {
            originalLength: text.length,
            humanizedLength: humanizedText.length,
            changePercentage: Math.abs(Math.round(((humanizedText.length - text.length) / text.length) * 100))
        }
    };
}

module.exports = {
    analyzeAiContent,
    humanizeContent
};
