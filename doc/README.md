# 🚀 GitHub Pages Publishing Guide for Docholder Privacy Policy

This directory (`/doc`) contains the official, production-ready Privacy Policy website and Data Safety declarations for **Docholder** (`com.docholder.app`).

---

## 🌐 1. How to Publish on GitHub Pages (Free Permanent URL)

Follow these 3 simple steps to publish your Privacy Policy live on GitHub Pages:

1. **Push your repository to GitHub:**
   ```bash
   git add docs/ doc/
   git commit -m "docs: add GitHub Pages privacy policy website and data safety kit"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your GitHub Repository: `https://github.com/arjunestudios-sys/CompressX`
   - Click **Settings** (⚙️ top menu).
   - In the left sidebar, click **Pages** (under the "Code and automation" section).
   - Under **Build and deployment > Source**, choose **Deploy from a branch**.
   - Under **Branch**, select `main` (or your default branch) and choose the folder **`/docs`**.
   - Click **Save**.

3. **Get your Live Privacy Policy URL:**
   - Within 1–2 minutes, GitHub will generate your live URL:
     ```text
     https://arjunestudios-sys.github.io/CompressX/
     ```
   - (Or if using a custom domain: `https://privacy.docholder.app` or `https://docholder.app/privacy-policy.html`)

---

## 📱 2. How to Link in Google Play Console

When submitting or updating your app in Google Play Console:

1. Open **Google Play Console** → Select your app (**Docholder**).
2. Scroll to the bottom of the left sidebar and click **Policy > App content**.
3. Under **Privacy Policy**, click **Start** (or **Manage**).
4. Paste your live GitHub Pages URL:
   ```text
   https://arjunestudios-sys.github.io/CompressX/
   ```
5. Click **Save**.

---

## 📦 3. Files Included in this Directory

| File | Purpose |
| :--- | :--- |
| `index.html` | Fully responsive standalone Privacy Policy website with dark/light mode, live search, Google Play Data Safety table, and print stylesheet. |
| `privacy-policy.js` | Universal JavaScript module providing the full policy data model, dynamic rendering methods, search index, and in-app modal launcher. |
| `PRIVACY_POLICY.md` | Standard Markdown document formatted for reading on GitHub or packaging with release documents. |
| `README.md` | This deployment and Google Play setup guide. |
