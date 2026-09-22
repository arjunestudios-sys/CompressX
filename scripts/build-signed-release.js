const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');
const KEYSTORE_FILE = path.join(ANDROID_DIR, 'docholder-release.jks');
const KEY_PROPS_FILE = path.join(ANDROID_DIR, 'key.properties');

const ALIAS = 'docholder';
const PASSWORD = process.env.KEYSTORE_PASSWORD || 'docholder2026!';
const DNAME = 'CN=Docholder, OU=Mobile, O=Docholder, L=City, ST=State, C=US';

function findKeytool() {
    try {
        execSync('keytool -help', { stdio: 'ignore' });
        return 'keytool';
    } catch (e) {
        // Continue searching
    }

    const searchDirs = [
        'C:\\Program Files\\Android\\Android Studio\\jbr\\bin',
        'C:\\Program Files\\Android\\Android Studio\\jre\\bin',
        'C:\\Program Files (x86)\\Android\\android-sdk\\jre\\bin',
        path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'jbr', 'bin')
    ];

    // Check Java Program Files
    ['C:\\Program Files\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft'].forEach(root => {
        if (fs.existsSync(root)) {
            try {
                fs.readdirSync(root).forEach(folder => {
                    searchDirs.push(path.join(root, folder, 'bin'));
                });
            } catch (err) {}
        }
    });

    if (process.env.JAVA_HOME) {
        searchDirs.unshift(path.join(process.env.JAVA_HOME, 'bin'));
    }

    for (const dir of searchDirs) {
        const candidate = path.join(dir, 'keytool.exe');
        if (fs.existsSync(candidate)) {
            return `"${candidate}"`;
        }
    }

    return null;
}

function ensureKeystore() {
    if (fs.existsSync(KEYSTORE_FILE)) {
        console.log(`✅ Keystore already exists: ${KEYSTORE_FILE}`);
    } else {
        const keytool = findKeytool();
        if (!keytool) {
            console.error('❌ Could not locate keytool.exe. Please ensure Java JDK or Android Studio is installed.');
            process.exit(1);
        }

        console.log(`🔑 Generating release keystore using ${keytool}...`);
        const genCmd = `${keytool} -genkeypair -v -keystore "${KEYSTORE_FILE}" -alias "${ALIAS}" -keyalg RSA -keysize 2048 -validity 10000 -dname "${DNAME}" -storepass "${PASSWORD}" -keypass "${PASSWORD}"`;
        execSync(genCmd, { stdio: 'inherit' });
        console.log(`✅ Release keystore created at ${KEYSTORE_FILE}`);
    }

    // Ensure key.properties is written
    const keyPropsContent = `# Auto-configured Release Signing
storeFile=docholder-release.jks
storePassword=${PASSWORD}
keyAlias=${ALIAS}
keyPassword=${PASSWORD}
`;
    fs.writeFileSync(KEY_PROPS_FILE, keyPropsContent, 'utf-8');
    console.log(`✅ Configured ${KEY_PROPS_FILE}`);
}

function runBuild() {
    console.log('\n🔄 1. Syncing Capacitor Android assets...');
    execSync('npx cap sync android', { cwd: PROJECT_ROOT, stdio: 'inherit' });

    console.log('\n📦 2. Building Signed Release Android App Bundle (.aab)...');
    const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execSync(`${gradlewCmd} bundleRelease`, { cwd: ANDROID_DIR, stdio: 'inherit' });

    console.log('\n📱 3. Building Signed Release APK (.apk)...');
    execSync(`${gradlewCmd} assembleRelease`, { cwd: ANDROID_DIR, stdio: 'inherit' });

    const aabPath = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
    const apkPath = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

    console.log('\n==================================================');
    console.log('🎉 SIGNED RELEASE BUILD COMPLETE!');
    console.log('==================================================');

    if (fs.existsSync(aabPath)) {
        const aabStats = fs.statSync(aabPath);
        console.log(`📦 Play Store Bundle (.aab): ${aabPath} (${(aabStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    } else {
        console.warn(`⚠️ Bundle not found at ${aabPath}`);
    }

    if (fs.existsSync(apkPath)) {
        const apkStats = fs.statSync(apkPath);
        console.log(`📱 Standalone Release APK (.apk): ${apkPath} (${(apkStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    } else {
        console.warn(`⚠️ APK not found at ${apkPath}`);
    }

    console.log(`🔑 Keystore Location: ${KEYSTORE_FILE}`);
    console.log(`🔑 Key Alias: ${ALIAS}`);
    console.log('==================================================\n');
}

try {
    ensureKeystore();
    runBuild();
} catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
}
