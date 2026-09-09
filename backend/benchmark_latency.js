const http = require('http');
const https = require('https');

const baseUrl = process.env.API_URL || 'https://compressx-backend.onrender.com';
const client = baseUrl.startsWith('https') ? https : http;

const endpoints = [
    { name: 'Root / Splash', path: '/' },
    { name: 'Dashboard HTML', path: '/dashboard.html' },
    { name: 'Health Endpoint', path: '/health' },
    { name: 'Files List', path: '/api/files' },
    { name: 'History API', path: '/api/convert/history' },
    { name: 'Theme CSS (cached)', path: '/css/theme.css' },
    { name: 'Core API JS (cached)', path: '/js/api.js' }
];

function measure(endpoint) {
    return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        const fullUrl = `${baseUrl.replace(/\/+$/, '')}${endpoint.path}`;
        const req = client.get(fullUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const end = process.hrtime.bigint();
                const ms = Number(end - start) / 1e6;
                resolve({ ...endpoint, status: res.statusCode, latencyMs: ms.toFixed(2) });
            });
        });
        req.on('error', (err) => {
            resolve({ ...endpoint, status: 'ERR', error: err.message, latencyMs: '0' });
        });
    });
}

async function run() {
    console.log('⚡ MEASURING APPLICATION LATENCY & RESPONSE TIME...\n');
    let total = 0;
    for (const ep of endpoints) {
        const result = await measure(ep);
        console.log(`[${result.status}] ${result.name.padEnd(24)} -> ${result.latencyMs} ms`);
        total += parseFloat(result.latencyMs);
    }
    console.log(`\nAverage Latency: ${(total / endpoints.length).toFixed(2)} ms`);
}

run();
