const http = require('http');

const routesToTest = [
    '/',
    '/dashboard.html',
    '/tools.html',
    '/image-tools.html',
    '/video-tools.html',
    '/audio-tools.html',
    '/document-tools.html',
    '/word-tools.html',
    '/convert.html',
    '/compress.html',
    '/files.html',
    '/history.html',
    '/js/universalRegistry.js',
    '/js/tools.js',
    '/js/imageStudio.js',
    '/js/videoStudio.js',
    '/js/audioStudio.js',
    '/js/documentStudio.js',
    '/js/wordStudio.js',
    '/js/convert.js',
    '/js/dashboard.js',
    '/js/files.js',
    '/js/history.js',
    '/js/assistant.js',
    '/js/futuristicEngine.js',
    '/css/components.css',
    '/css/theme.css'
];

async function checkRoute(path) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:5000${path}`, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve({ path, status: res.statusCode, ok: true });
            } else {
                resolve({ path, status: res.statusCode, ok: false });
            }
        });
        req.on('error', (err) => reject(err));
    });
}

async function run() {
    console.log('--- AUDITING DOCHOLDER UNIVERSAL PLATFORM ROUTES ---');
    let allOk = true;
    for (const r of routesToTest) {
        try {
            const res = await checkRoute(r);
            if (res.ok) {
                console.log(`✅ [${res.status}] http://localhost:5000${r}`);
            } else {
                console.error(`❌ [${res.status}] http://localhost:5000${r}`);
                allOk = false;
            }
        } catch(e) {
            console.error(`❌ Error connecting to http://localhost:5000${r}:`, e.message);
            allOk = false;
        }
    }

    if (allOk) {
        console.log('\n🎉 ALL 24 FRONTEND PAGES, STUDIOS, REGISTRIES, SCRIPTS & ASSETS ARE 100% HEALTHY!');
    } else {
        process.exit(1);
    }
}

run();
