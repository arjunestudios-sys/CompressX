/**
 * Docholder — AI Routes (/api/ai)
 * All endpoints proxy to gemini.service.js which reads
 * GEMINI_API_KEY from process.env only.
 */

const express    = require("express");
const router     = express.Router();
const gemini     = require("../services/gemini.service");
const authMiddleware = require("../middleware/auth");

// ── Health check — is the key configured? ──────────────────────────
router.get("/status", (req, res) => {
    res.json({
        configured: gemini.isConfigured(),
        model: "gemini-2.0-flash-latest",
        message: gemini.isConfigured() ? "Gemini AI is ready." : "GEMINI_API_KEY is not set in .env"
    });
});

// ── General text generation ────────────────────────────────────────
router.post("/generate", authMiddleware, async (req, res) => {
    try {
        const { prompt, temperature, maxOutputTokens } = req.body;
        if (!prompt) return res.status(400).json({ error: "prompt is required" });
        const result = await gemini.generateText(prompt, { temperature, maxOutputTokens });
        res.json({ result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Humanize text ──────────────────────────────────────────────────
router.post("/humanize", authMiddleware, async (req, res) => {
    try {
        const { text, mode } = req.body;
        if (!text) return res.status(400).json({ error: "text is required" });
        const humanizedText = await gemini.humanizeText(text, mode || "Natural");
        res.json({
            originalText:   text,
            humanizedText,
            mode:           mode || "Natural",
            charactersUsed: text.length
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── AI content detection ───────────────────────────────────────────
router.post("/detect", authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "text is required" });
        const analysis = await gemini.analyzeAiContent(text);
        res.json(analysis);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Summarize document text ────────────────────────────────────────
router.post("/summarize", authMiddleware, async (req, res) => {
    try {
        const { text, format } = req.body;
        if (!text) return res.status(400).json({ error: "text is required" });
        const summary = await gemini.summarizeText(text, format || "bullet");
        res.json({ summary, format: format || "bullet" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Translate text ─────────────────────────────────────────────────
router.post("/translate", authMiddleware, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        if (!text)           return res.status(400).json({ error: "text is required" });
        if (!targetLanguage) return res.status(400).json({ error: "targetLanguage is required" });
        const translatedText = await gemini.translateText(text, targetLanguage);
        res.json({ originalText: text, translatedText, targetLanguage });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Build AI workflow from natural language command ────────────────
router.post("/workflow", authMiddleware, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "query is required" });
        const workflow = await gemini.buildAiWorkflow(query);
        res.json(workflow);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
