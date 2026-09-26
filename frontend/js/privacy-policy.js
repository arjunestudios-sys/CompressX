/**
 * Docholder Privacy Policy & Data Safety Module
 * Version: 1.5.0
 * Updated: September 2026
 * 
 * Supports:
 * - Browser Global (window.DocholderPrivacyPolicy)
 * - CommonJS (module.exports)
 * - ES Module export
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DocholderPrivacyPolicy = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const policyData = {
        metadata: {
            appName: "Docholder",
            companyName: "Docholder Open Source Project / Arjun Studios",
            appId: "com.docholder.app",
            version: "1.5.0",
            effectiveDate: "September 22, 2026",
            lastUpdated: "September 22, 2026",
            contactEmail: "privacy@docholder.app",
            websiteUrl: "https://docholder.app",
            githubUrl: "https://github.com/arjunestudios-sys/CompressX",
            dpoContact: "dpo@docholder.app"
        },
        
        highlights: [
            {
                icon: "shield-check",
                title: "Privacy First & Zero Data Sale",
                description: "We do not sell, rent, or monetize your personal files, metadata, or browsing information to any third party or advertising broker."
            },
            {
                icon: "lock",
                title: "Local-First & Ephemeral Cloud Processing",
                description: "Where possible, operations occur on-device. Temporary files processed on backend servers are cryptographically isolated and automatically deleted within 1 hour."
            },
            {
                icon: "eye-slash",
                title: "No Invasive Trackers",
                description: "Docholder does not bundle invasive third-party ad networks, behavioural trackers, or biometric harvesting SDKs."
            },
            {
                icon: "user-gear",
                title: "Complete User Control",
                description: "You have full rights to export, wipe, or purge your account data, transformation logs, and cached documents with a single click."
            }
        ],

        dataSafety: {
            googlePlaySummary: "Docholder is built around user privacy. We do not sell user data. Files uploaded for conversion are processed ephemerally and deleted automatically. Account creation is optional.",
            declarations: [
                {
                    dataCategory: "Personal Info (Name, Email)",
                    collected: "Optional",
                    shared: "No",
                    purpose: "Account authentication, cloud vault synchronization, and account recovery.",
                    ephemeral: "Stored until account deletion by user.",
                    encrypted: "Yes (TLS in transit, bcrypt hashed passwords)."
                },
                {
                    dataCategory: "Files & Documents (PDF, DOCX, XLSX, Images, Videos, Audio)",
                    collected: "Only when explicitly selected/uploaded by user for processing",
                    shared: "No",
                    purpose: "Executing user-requested operations (compression, conversion, OCR, redaction, encryption, watermarking).",
                    ephemeral: "Temporary processing files purged within 1 hour via automated cron jobs.",
                    encrypted: "Yes (HTTPS/TLS in transit, optional AES-256 file encryption)."
                },
                {
                    dataCategory: "Camera & Photos",
                    collected: "No (Local on-device stream)",
                    shared: "No",
                    purpose: "Document scanner and photo capture for OCR / PDF creation.",
                    ephemeral: "Processed in device memory or saved strictly to local user storage.",
                    encrypted: "N/A (Remains on local hardware)."
                },
                {
                    dataCategory: "Device or other IDs & App Performance",
                    collected: "No persistent device tracking IDs",
                    shared: "No",
                    purpose: "Basic error logging during active session diagnostics without hardware fingerprinting.",
                    ephemeral: "Session-scoped.",
                    encrypted: "Yes."
                }
            ]
        },

        permissions: [
            {
                permission: "Camera (CAMERA)",
                platform: "Android / Web",
                usage: "Allows you to capture documents, receipts, and photos for real-time scanning, OCR, or PDF generation.",
                required: "Optional (Requested only when opening scanner features)"
            },
            {
                permission: "Storage / Photos (READ_MEDIA_IMAGES / Storage Access Framework)",
                platform: "Android / Web",
                usage: "Allows importing files to convert or compress, and saving processed results to your device's Downloads or Document folders.",
                required: "Required for saving/loading local files"
            },
            {
                permission: "Internet & Network State (INTERNET, ACCESS_NETWORK_STATE)",
                platform: "Android / Web",
                usage: "Enables connection to server-side transformation engines (for heavy video/PDF workflows) and checks connectivity status.",
                required: "Required for cloud-assisted features"
            },
            {
                permission: "Microphone (RECORD_AUDIO)",
                platform: "Android / Web",
                usage: "Used solely when user explicitly initiates voice memos, audio extraction, or speech-to-text recording.",
                required: "Optional (Requested on demand)"
            }
        ],

        sections: [
            {
                id: "introduction",
                title: "1. Introduction & Overview",
                content: `Welcome to **Docholder** ("we", "our", or "us"). We provide an intelligent, multi-purpose document management, transformation, compression, and media utility platform.

This Privacy Policy explains how Docholder collects, uses, protects, and discloses information when you use our mobile application, web dashboard, and related services. By accessing or using Docholder, you agree to the transparent data practices described in this document.`
            },
            {
                id: "information-collection",
                title: "2. Information We Collect",
                subsections: [
                    {
                        subtitle: "A. Information You Voluntarily Provide",
                        text: `• **Account Information (Optional):** When creating an optional cloud account, we collect your email address, username, and a securely salted/hashed password (via bcrypt). Account creation is optional—core conversion and compression features operate without an account.
• **User Files & Documents:** Files you select for conversion, compression, merging, editing, watermarking, redaction, or OCR (such as PDFs, Word files, images, audio, and video files).`
                    },
                    {
                        subtitle: "B. Information Processed Automatically",
                        text: `• **Device & Network Diagnostics:** IP address and network connectivity status for routing server requests securely and managing rate limiting against automated abuse.
• **Transformation Logs (Local):** Your recent history of file actions is stored in your local browser/device storage (IndexedDB/LocalStorage) and can be cleared at any time in Settings.`
                    },
                    {
                        subtitle: "C. Information We NEVER Collect",
                        text: `• We do **not** collect your contacts, phonebook, GPS location coordinates, or advertising identifiers (GAID/IDFA).
• We do **not** sell, broker, or monetize your documents or personal profile.`
                    }
                ]
            },
            {
                id: "file-processing-retention",
                title: "3. File Processing & Automatic Retention Lifecycle",
                content: `Docholder follows a strict **ephemeral data lifecycle**:

1. **Local Processing First:** Client-side tasks (such as local image compression, basic PDF reordering, and canvas-based manipulations) remain strictly within your device memory.
2. **Server-Side Conversion Pipelines:** When a task requires server-side computing (e.g. FFmpeg video transcode, LibreOffice/Muhammara document conversions, or deep OCR), the file is transferred over encrypted HTTPS (TLS 1.3).
3. **Automated 1-Hour Purge:** Uploaded temporary files and converted artifacts in server scratch directories are automatically erased by background cleanup cron jobs within **1 hour** of creation.
4. **Encrypted Vault Storage (Optional):** If you choose to save documents into your private user account vault, files are stored with restricted per-user access controls until you manually delete them.`
            },
            {
                id: "ai-third-party",
                title: "4. Third-Party Integrations & AI Processing",
                content: `• **AI Assistant & OCR Features (Optional):** Certain advanced features (such as AI document summarization or smart OCR) utilize Google Gemini API / OCR engines. Text snippets submitted to AI features are processed in transit solely to fulfill the requested analysis and are not used to train global AI models on your private data.
• **No Third-Party Advertising:** Docholder does not contain third-party advertising SDKs (e.g., Google AdMob, Unity Ads, Meta Audience Network).
• **Infrastructure Providers:** Backend services may be hosted on secure enterprise cloud infrastructure (e.g. Render, Railway, AWS) compliant with ISO 27001 and SOC 2 security standards.`
            },
            {
                id: "security-measures",
                title: "5. Data Security & Encryption Standards",
                content: `We implement robust technical and organizational security controls:

• **Transit Encryption:** All network traffic between your client device and our servers is encrypted using modern **HTTPS with TLS 1.3**.
• **Password Security:** All account passwords are encrypted using multi-round **bcrypt** cryptographic hashing with unique salts.
• **Access Control:** Vault files are tied strictly to authenticated JSON Web Tokens (JWT) with secure signing keys.
• **PII Redaction Engine:** Docholder includes a built-in Privacy Scanner & Redaction tool allowing users to sanitize names, phone numbers, credit cards, and social security numbers prior to sharing.`
            },
            {
                id: "user-rights",
                title: "6. Your Data Rights (GDPR & CCPA Compliance)",
                content: `Regardless of your geographic location, Docholder honors fundamental privacy rights:

• **Right to Access & Portability:** You can export all your stored vault files and account profile data.
• **Right to Erasure ('Right to be Forgotten'):** You can permanently delete your account, vault storage, and transformation logs at any time via the **Settings > Storage & Data Management** menu.
• **Right to Rectify:** You can update your email and account credentials directly.
• **Right to Restrict Processing:** You can choose offline/local-only workflows by disabling cloud sync.`
            },
            {
                id: "children-privacy",
                title: "7. Children's Privacy",
                content: `Docholder does not knowingly collect, solicit, or store personal information from children under the age of 13 (or under 16 in the European Union). If we learn that we have inadvertently collected personal information from a minor, we will promptly delete that data.`
            },
            {
                id: "changes-policy",
                title: "8. Changes to This Privacy Policy",
                content: `We may periodically update this Privacy Policy to reflect app enhancements, regulatory requirements, or security adjustments. The "Last Updated" timestamp at the top of this policy reflects the current revision date. Material changes will be accompanied by an in-app notice or release changelog.`
            },
            {
                id: "contact-us",
                title: "9. Contact & Inquiries",
                content: `If you have questions, feedback, or data privacy requests regarding this policy or our data practices, please contact us at:

• **Email:** privacy@docholder.app / arjunestudios@gmail.com
• **GitHub Repository:** [https://github.com/arjunestudios-sys/CompressX](https://github.com/arjunestudios-sys/CompressX)
• **Data Protection Office:** dpo@docholder.app`
            }
        ]
    };

    return {
        getPolicyData: function () {
            return JSON.parse(JSON.stringify(policyData));
        },

        getMetadata: function () {
            return { ...policyData.metadata };
        },

        getSections: function () {
            return [...policyData.sections];
        },

        getHighlights: function () {
            return [...policyData.highlights];
        },

        getDataSafety: function () {
            return JSON.parse(JSON.stringify(policyData.dataSafety));
        },

        getPermissions: function () {
            return [...policyData.permissions];
        },

        search: function (query) {
            if (!query || typeof query !== 'string') return policyData.sections;
            const q = query.toLowerCase().trim();
            return policyData.sections.filter(sec => {
                const titleMatch = sec.title.toLowerCase().includes(q);
                const contentMatch = sec.content && sec.content.toLowerCase().includes(q);
                const subMatch = sec.subsections && sec.subsections.some(sub => 
                    sub.subtitle.toLowerCase().includes(q) || sub.text.toLowerCase().includes(q)
                );
                return titleMatch || contentMatch || subMatch;
            });
        },

        toMarkdown: function () {
            const m = policyData.metadata;
            let md = `# Privacy Policy for ${m.appName}\n\n`;
            md += `**Effective Date:** ${m.effectiveDate}  \n`;
            md += `**Last Updated:** ${m.lastUpdated}  \n`;
            md += `**App ID:** \`${m.appId}\`  \n`;
            md += `**Contact:** [${m.contactEmail}](mailto:${m.contactEmail})\n\n---\n\n`;

            md += `## 🌟 Privacy Highlights\n\n`;
            policyData.highlights.forEach(h => {
                md += `### ${h.title}\n${h.description}\n\n`;
            });

            md += `---\n\n## 🛡️ Google Play Data Safety Declaration\n\n`;
            md += `| Data Type | Collected | Shared | Purpose | Retention | Security |\n`;
            md += `| :--- | :---: | :---: | :--- | :--- | :--- |\n`;
            policyData.dataSafety.declarations.forEach(d => {
                md += `| **${d.dataCategory}** | ${d.collected} | ${d.shared} | ${d.purpose} | ${d.ephemeral} | ${d.encrypted} |\n`;
            });

            md += `\n---\n\n## 📱 Device Permissions\n\n`;
            md += `| Permission | Platform | Purpose | Status |\n`;
            md += `| :--- | :--- | :--- | :--- |\n`;
            policyData.permissions.forEach(p => {
                md += `| **${p.permission}** | ${p.platform} | ${p.usage} | ${p.required} |\n`;
            });

            md += `\n---\n\n`;
            policyData.sections.forEach(sec => {
                md += `## ${sec.title}\n\n`;
                if (sec.content) {
                    md += `${sec.content}\n\n`;
                }
                if (sec.subsections) {
                    sec.subsections.forEach(sub => {
                        md += `### ${sub.subtitle}\n\n${sub.text}\n\n`;
                    });
                }
            });

            return md;
        },

        renderToContainer: function (containerId, options = {}) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const m = policyData.metadata;
            let html = `
            <div class="privacy-policy-wrapper">
                <header class="pp-header">
                    <span class="pp-badge">Official Policy</span>
                    <h1 class="pp-title">Privacy Policy for ${m.appName}</h1>
                    <p class="pp-meta">
                        <span><strong>Effective:</strong> ${m.effectiveDate}</span> • 
                        <span><strong>Last Updated:</strong> ${m.lastUpdated}</span> • 
                        <span><strong>App ID:</strong> <code>${m.appId}</code></span>
                    </p>
                </header>

                <div class="pp-highlights-grid">
                    ${policyData.highlights.map(h => `
                        <div class="pp-highlight-card">
                            <div class="pp-highlight-icon">🛡️</div>
                            <h3>${h.title}</h3>
                            <p>${h.description}</p>
                        </div>
                    `).join('')}
                </div>

                <div class="pp-content-body">
                    ${policyData.sections.map(sec => `
                        <section id="${sec.id}" class="pp-section">
                            <h2>${sec.title}</h2>
                            ${sec.content ? `<div class="pp-text">${sec.content.replace(/\n\n/g, '<br><br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>` : ''}
                            ${sec.subsections ? sec.subsections.map(sub => `
                                <div class="pp-subsection">
                                    <h3>${sub.subtitle}</h3>
                                    <div class="pp-text">${sub.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
                                </div>
                            `).join('') : ''}
                        </section>
                    `).join('')}
                </div>
            </div>`;
            container.innerHTML = html;
        },

        openModal: function () {
            let modal = document.getElementById('privacy-policy-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'privacy-policy-modal';
                modal.className = 'pp-modal-backdrop';
                modal.innerHTML = `
                    <div class="pp-modal-window">
                        <div class="pp-modal-header">
                            <h2>Docholder Privacy Policy</h2>
                            <button class="pp-modal-close" onclick="document.getElementById('privacy-policy-modal').remove()">&times;</button>
                        </div>
                        <div id="pp-modal-container" class="pp-modal-body"></div>
                        <div class="pp-modal-footer">
                            <a href="privacy-policy.html" target="_blank" class="pp-btn-link">Open Full Page</a>
                            <button class="pp-btn-primary" onclick="document.getElementById('privacy-policy-modal').remove()">Understood</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            this.renderToContainer('pp-modal-container');
            modal.style.display = 'flex';
        }
    };
}));
