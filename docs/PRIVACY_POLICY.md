# Privacy Policy & Data Safety Declaration

**Application Name:** Docholder (Document & Media Transformation Studio)  
**Package / Application ID:** `com.docholder.app`  
**Effective Date:** September 22, 2026  
**Last Updated:** September 22, 2026  
**Repository:** [https://github.com/arjunestudios-sys/CompressX](https://github.com/arjunestudios-sys/CompressX)  
**Contact Email:** [privacy@docholder.app](mailto:privacy@docholder.app) | [arjunestudios@gmail.com](mailto:arjunestudios@gmail.com)  

---

## 🌟 1. Executive Summary & Privacy Principles

Docholder was engineered from the ground up on the foundation of **user data sovereignty**, **ephemeral processing**, and **zero monetization of private user content**.

- ❌ **No Data Selling:** We never sell, rent, or trade your files, personal profile, or behavioral data.
- ⚡ **Local-First Architecture:** Lightweight operations (image compression, basic PDF manipulation, canvas editing) execute directly in device memory.
- ⏱️ **Automatic 1-Hour Purge:** Server-side transformation files are cryptographically segregated and wiped permanently within **1 hour** of processing.
- 🛡️ **Zero Ad Trackers:** No invasive third-party ad networks, telemetry trackers, or fingerprinting scripts are bundled in the application.

---

## 🛡️ 2. Google Play Data Safety Compliance

In accordance with Google Play Developer Policy and global privacy standards (GDPR, CCPA, CPRA), we disclose all data types processed by Docholder:

| Data Type / Category | Collected? | Shared with Third Parties? | Purpose | Retention Duration | Security / Encryption |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Personal Info (Email, Username)** | Optional | **No** | Account authentication, cloud sync (if user registers). | Until user requests deletion | Encrypted (TLS 1.3 + bcrypt salt) |
| **User Documents & Files (PDF, Word, Images, Video, Audio)** | On user upload only | **No** | Executing conversion, compression, OCR, and editing tasks. | Ephemeral (Auto-purged in 1 hour) | Encrypted (HTTPS / TLS 1.3) |
| **Photos & Camera Stream** | **No** (Local hardware) | **No** | Real-time document scanner & OCR text extraction. | Not stored on external servers | On-device memory only |
| **Diagnostics & Server Logs** | Session only | **No** | Server routing, rate limiting, and abuse prevention. | Ephemeral rolling logs | Encrypted in transit |

---

## 📱 3. Device Permissions & Transparency

Docholder requests only the minimum permissions necessary for requested features:

| Permission | Android Name | Platform | Reason for Usage |
| :--- | :--- | :--- | :--- |
| **Camera** | `android.permission.CAMERA` | Android / Web | Capturing physical documents, receipts, and photos for document scanning and OCR conversion. |
| **Storage & Photos** | `READ_MEDIA_IMAGES` / SAF | Android / Web | Selecting files for compression and saving transformed files to device storage. |
| **Internet Access** | `android.permission.INTERNET` | Android / Web | Communicating with conversion backend for high-intensity processing (FFmpeg video encoding, multi-page OCR). |
| **Network State** | `android.permission.ACCESS_NETWORK_STATE` | Android / Web | Detecting offline/online status to switch smoothly between local and cloud tools. |
| **Microphone** | `android.permission.RECORD_AUDIO` | Android / Web | Optional audio recording for transcription and voice memo utilities. |

---

## 🔒 4. Data Processing, Storage & Security Architecture

### 4.1 Ephemeral Processing Pipelines
When files are sent to the backend conversion engine:
1. Files are assigned randomized cryptographic UUID names in isolated temporary scratch directories.
2. The transformation task (e.g. Sharp image resizing, Muhammara / pdf-lib compilation, FFmpeg encoding) executes.
3. Once converted, the user downloads the output file.
4. An automated background cleanup cron service runs continuously, purging temporary files and artifacts older than **1 hour**.

### 4.2 Encryption & Cryptographic Standards
- **In-Transit:** 100% of network requests use **HTTPS (TLS 1.3)** with strict transport security.
- **At-Rest (User Passwords):** Salted and hashed with **bcrypt** (10+ rounds).
- **Document Protection:** Built-in PDF encryption module supports standard AES-256 password protection.

---

## 🤖 5. Artificial Intelligence & Third-Party Services

Docholder includes optional AI-assisted tools (e.g., AI document summarizer, intelligent redaction, and OCR) powered by the Google Gemini API:
- **Scope of Data:** Only the specific text snippet you actively choose to submit is sent.
- **No Training On Private Data:** Google Gemini API enterprise terms state that data sent via the API is not used to train base foundation models.
- **Zero Third-Party Advertising:** No third-party marketing SDKs (Google AdMob, Meta Ads, AppLovin) exist in Docholder.

---

## ⚖️ 6. Your Rights & Global Compliance (GDPR, CCPA & APPI)

Every user has full sovereignty over their data:

1. **Right of Access & Portability:** You can export all documents stored in your vault.
2. **Right to Erasure ("Right to be Forgotten"):** You can permanently delete your account, wipe cloud vault files, and reset local caches instantly from **Settings > Storage & Data Management**.
3. **Right to Rectification:** You can update or amend your account credentials at any time.
4. **Right to Offline Usage:** You can disconnect or use offline tools without cloud dependencies.

---

## 👶 7. Children's Privacy (COPPA)

Docholder does not direct its services toward children under the age of 13 (or under 16 in the EEA/UK), nor do we knowingly collect identifiable information from minors. If you believe a child has provided us with personal information, please contact us for immediate erasure.

---

## 📝 8. Updates to This Policy

We may update this Privacy Policy from time to time to align with new application capabilities or regulatory standards. Material changes will be communicated via release notes or in-app notifications.

---

## 📬 9. Contact Us

For privacy inquiries, Data Protection Officer requests, or deletion requests:

- **Official Privacy Email:** [privacy@docholder.app](mailto:privacy@docholder.app)
- **Developer Support:** [arjunestudios@gmail.com](mailto:arjunestudios@gmail.com)
- **GitHub Repository:** [https://github.com/arjunestudios-sys/CompressX](https://github.com/arjunestudios-sys/CompressX)
- **Data Protection Officer:** [dpo@docholder.app](mailto:dpo@docholder.app)
