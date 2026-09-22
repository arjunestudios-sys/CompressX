# 🚀 Docholder — Production Release & Launch Guide

This master guide contains everything needed to prepare, build, sign, deploy, and launch **Docholder** on both Cloud Hosting and the **Google Play Store**.

---

## 📋 Table of Contents
1. [Pre-Release Checklist](#1-pre-release-checklist)
2. [Android Release Build & Signing](#2-android-release-build--signing)
3. [Backend Production Deployment](#3-backend-production-deployment)
4. [Google Play Store Submission Kit](#4-google-play-store-submission-kit)
5. [Data Safety & Permissions Declaration](#5-data-safety--permissions-declaration)
6. [Post-Launch Monitoring & Maintenance](#6-post-launch-monitoring--maintenance)

---

## 1. Pre-Release Checklist

| Item | Status | Notes |
| :--- | :---: | :--- |
| **Frontend Assets Synced** | ✅ Ready | `npm run cap:sync` / `npx cap sync android` |
| **App Name & ID** | ✅ Verified | App ID: `com.docholder.app`, Name: `Docholder` |
| **Icons & Splash Screen** | ✅ Generated | Adaptive icons & splash assets in `android/app/src/main/res/` |
| **Privacy Policy** | ✅ Created | `privacy-policy.html` included in project |
| **Dynamic API Detection** | ✅ Configured | Auto-falls back to Render backend host or custom setting |
| **Pull-to-Refresh & Offline State** | ✅ Configured | Dynamic network status indicator and toast notifications |

---

## 2. Android Release Build & Signing

Google Play Store requires an **Android App Bundle (`.aab`)** signed with a secure release keystore.

### Step 2.1: Generate a Release Keystore
Run the following command in your terminal (PowerShell or Git Bash):

```bash
keytool -genkey -v -keystore docholder-release.jks -alias docholder -keyalg RSA -keysize 2048 -validity 10000
```
> ⚠️ **IMPORTANT**: Keep `docholder-release.jks` and its passwords in a secure backup. If you lose this key, you will NOT be able to update your app on Google Play!

### Step 2.2: Configure Gradle Signing Credentials
Create a file named `android/key.properties` (this is automatically gitignored):

```properties
storeFile=../../docholder-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=docholder
keyPassword=YOUR_KEY_PASSWORD
```

Then, in `android/app/build.gradle`, add the release signing config:
```groovy
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 2.3: Build Release Packages

#### Option A: Build Google Play Store Bundle (`.aab`) — Recommended for Play Store
```bash
npm run build:bundle:release
```
**Output Location:** `android/app/build/outputs/bundle/release/app-release.aab`

#### Option B: Build Standalone Signed APK (`.apk`) — For Direct Download / Testing
```bash
npm run build:apk:release
```
**Output Location:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 3. Backend Production Deployment

### Step 3.1: Environment Variables Setup
Set the following environment variables in your production hosting platform (e.g. Render, Railway, Heroku, or VPS):

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your_super_secret_64_character_hex_key
JWT_EXPIRES_IN=never
STORAGE_LIMIT_BYTES=524288000
ALLOWED_ORIGINS=https://compressx-backend.onrender.com,https://docholder.app,capacitor://localhost,http://localhost
GEMINI_API_KEY=your_google_gemini_api_key
```

### Step 3.2: Production Start Command
```bash
npm run start:prod
```
Or with PM2 (on VPS):
```bash
pm2 start backend/server.js --name "docholder-api" -i max
```

### Step 3.3: Automated Maintenance
The backend includes automated cron jobs:
- Temporary uploaded files in `backend/uploads/` are automatically cleaned up every hour.
- Expired sharing vault links and tokens are purged automatically.

---

## 4. Google Play Store Submission Kit

### 4.1 App Details
- **App Title:** `Docholder: PDF & Media Tools` (or `Docholder — Document & Media Hub`)
- **Short Description (80 characters):**
  > All-in-one document suite: Convert, Compress, Edit PDF, OCR, and media tools.
- **Full Description:**
```text
Docholder is your complete, all-in-one document management and media transformation studio. Designed for speed, security, and versatility, Docholder empowers you to handle every document and file format effortlessly on your device.

🔥 KEY FEATURES:

📄 ADVANCED PDF SUITE:
• Merge & Split PDF pages with instant visual reordering.
• Compress PDF file sizes while maintaining sharp vector & text clarity.
• Convert PDF to Word (DOCX), Excel (XLSX), Images (PNG/JPG), and TXT.
• Secure PDF files with AES-256 encryption or remove passwords.
• Sign, watermark, and annotate PDFs with professional tools.

🖼️ IMAGE STUDIO:
• Compress images with high visual fidelity (JPG, PNG, WebP, AVIF).
• Instant background removal and smart resizing.
• Universal conversion between WebP, PNG, JPG, GIF, SVG, and TIFF.
• Optical Character Recognition (OCR) to extract text from images in seconds.

🎬 VIDEO & AUDIO ENGINE:
• Compress large video files without noticeable quality loss (MP4, MKV, MOV, WebM).
• Extract crystal-clear audio tracks (MP3, WAV, AAC, M4A) from videos.
• Trim, cut, and optimize multimedia for fast sharing and messaging apps.

🔒 PRIVACY & SECURITY FIRST:
• Secure local and cloud processing options.
• Encrypted document storage and private sharing vaults.
• Transparent data handling with zero tracking or unauthorized data retention.

⚡ FAST & INTUITIVE:
• Clean, modern dark/light themes tailored for mobile.
• Smooth gestures, pull-to-refresh, and batch file processing.
```

### 4.2 Categories & Tags
- **Primary Category:** Productivity
- **Secondary Category:** Tools / Business
- **Tags:** PDF Editor, PDF Converter, File Compressor, Document Scanner, OCR, Video Compressor, Word to PDF.

---

## 5. Data Safety & Permissions Declaration

When filling out the Google Play **Data Safety Form**, declare the following:

| Permission / Data | Purpose | Collected / Shared? |
| :--- | :--- | :--- |
| **Camera** (`android.permission.CAMERA`) | Document scanner and photo capture for OCR / PDF creation. | **No** (Processed locally on request) |
| **Storage / Photos** | Loading documents and saving converted files to device storage. | **No** (Stored only on user's device) |
| **Internet / Network State** | Connecting to document conversion engine and syncing account data. | Transferred encrypted over HTTPS (TLS) |
| **User Account Info (Optional)** | Email & username for cloud sync and history across devices. | Encrypted; users can delete their account anytime. |

**Privacy Policy URL:**
Provide your hosted URL (e.g. `https://your-domain.com/privacy-policy.html` or Render backend URL `https://compressx-backend.onrender.com/privacy-policy.html`).

---

## 6. Post-Launch Monitoring & Maintenance

1. **Version Increment Protocol**:
   Before every new update, bump the version in two places:
   - `package.json`: `"version": "1.2.0"`
   - `android/app/build.gradle`:
     ```groovy
     versionCode 3 // Increment by 1 for each Play Store release
     versionName "1.2.0"
     ```
2. **Build & Sync Command**:
   ```bash
   node node_modules/@capacitor/cli/bin/capacitor sync android
   npm run build:bundle:release
   ```
3. **Upload `.aab` to Google Play Console** under **Release > Production / Open Testing**.
