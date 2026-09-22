const fs = require('fs');
const path = require('path');
const aiService = require('./services/aiIntelligence.service');
const docVerifService = require('./services/documentVerification.service');
const optService = require('./services/smartOptimization.service');
const privacyService = require('./services/privacySecurity.service');
const transService = require('./services/translation.service');
const sheetService = require('./services/spreadsheetIntelligence.service');
const shareService = require('./services/sharingVault.service');
const usageService = require('./services/usage.service');
const notifService = require('./services/notification.service');

async function runMasterTests() {
    console.log('\n====================================================');
    console.log('   DOCHOLDER MASTER FEATURES UNIT VERIFICATION      ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`• Testing: ${msg}... ✓ PASSED`);
            passed++;
        } else {
            console.error(`• Testing: ${msg}... ❌ FAILED`);
            failed++;
        }
    }

    try {
        // 1. AI Content Detector
        const sampleText = "Furthermore, it is important to note that artificial intelligence demonstrates transformative capabilities. Moreover, in conclusion, this report delves into key findings.";
        const aiResult = await aiService.analyzeAiContent(sampleText);
        assert(aiResult.aiLikeness > 50 && aiResult.signals.length > 0, 'AI Content Rate Tracker analysis');

        // 2. Smart Humanizer
        const humResult = await aiService.humanizeContent({ text: sampleText, mode: 'Natural' });
        assert(humResult.humanizedText && humResult.charactersUsed > 0, 'Smart Humanizer with character counting');

        // 3. Document Fact Checker
        const factResult = await docVerifService.factCheckDocument("In 2026, revenue increased by 45% reaching $10M.");
        assert(factResult.totalClaims > 0 && factResult.claims.length > 0, 'Document Fact Checker');

        // 4. Document DNA & Health Score
        const testPdf = path.join(__dirname, 'test_output', 'dna_test.pdf');
        if (!fs.existsSync(path.dirname(testPdf))) fs.mkdirSync(path.dirname(testPdf), { recursive: true });
        fs.writeFileSync(testPdf, '%PDF-1.4 %hello world');

        const dnaResult = await docVerifService.generateDocumentDna(testPdf, 'dna_test.pdf');
        assert(dnaResult.fingerprint && dnaResult.pages >= 1, 'Document DNA Fingerprint');

        const healthResult = await docVerifService.calculateHealthScore(testPdf, 'dna_test.pdf');
        assert(healthResult.healthScore > 0 && healthResult.checks.length > 0, 'Document Health Score');

        // 5. Goal-Based Optimization
        const optPdf = path.join(__dirname, 'test_output', 'opt_test.pdf');
        const optResult = await optService.optimizeForGoal(testPdf, optPdf, 'email');
        assert(optResult.goal === 'email' && fs.existsSync(optPdf), 'Goal-Based Optimization');

        // 6. Privacy Scanner & PII Redaction
        const piiScan = await privacyService.scanPrivacyRisk(sampleText + ' Contact support@docholder.com or 555-123-4567.');
        assert(piiScan.totalFindings > 0 && piiScan.breakdown.emails.count > 0, 'Privacy Risk Scanner');

        // 7. Universal Translation
        const transResult = await transService.translateDocument(testPdf, 'Tamil', 'dna_test.pdf');
        assert(transResult.targetLanguage === 'Tamil' && transResult.translatedContent, 'Universal Translation Workspace');

        // 8. Smart Share Links & Vault
        const shareResult = shareService.createShareLink(1, 100, { expirationHours: 24 });
        assert(shareResult.shareUrl && shareResult.token, 'Smart Share Links');

        const vaultResult = shareService.addToVault(1, 100, 24);
        assert(vaultResult.vaultId && vaultResult.retentionHours === 24, 'Temporary File Vault');

        // 9. Mobile Push Notification
        const notifResult = await notifService.sendMobileNotification(1, { title: 'Test', message: 'Hello' });
        assert(notifResult.delivered === true, 'Mobile Push Notification System');

    } catch (err) {
        console.error('Master Test Exception:', err);
    }

    console.log('\n====================================================');
    console.log(`MASTER RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
}

runMasterTests();
