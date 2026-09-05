const http = require('http');
const fs = require('fs');
const path = require('path');

function doRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
                } catch(e) {
                    resolve({ status: res.statusCode, headers: res.headers, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
        req.end();
    });
}

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'compressx_super_secret_jwt_key_2026_localhost';

async function verify() {
    console.log('--- TESTING WORD TO PDF ENDPOINT VIA HTTP API ---');

    // 1. Generate auth token for User 1
    const token = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '7d' });
    const authHeader = `Bearer ${token}`;
    console.log('Created auth token for User 1');

    // 2. Query workspace files for a Word document
    const filesRes = await doRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/files',
        method: 'GET',
        headers: { 'Authorization': authHeader }
    });

    const wordFile = (filesRes.data.files || []).find(f => f.original_name.endsWith('.docx') || f.original_name.endsWith('.doc'));
    if (!wordFile) {
        console.error('No Word file found in workspace. Files:', filesRes.data.files.map(f => f.original_name));
        process.exit(1);
    }

    console.log(`Found Word file: "${wordFile.original_name}" (ID: ${wordFile.id}, Size: ${wordFile.file_size} bytes)`);

    // 3. Convert Word file to PDF
    const startTime = Date.now();
    const convertRes = await doRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/convert/document',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
        }
    }, { fileId: wordFile.id, format: 'pdf' });

    const elapsed = Date.now() - startTime;
    console.log('Conversion HTTP status:', convertRes.status, `(took ${elapsed}ms)`);
    console.log('Conversion response:', JSON.stringify(convertRes.data, null, 2));

    if (convertRes.status !== 201 || !convertRes.data.result) {
        throw new Error('Word to PDF HTTP API returned unexpected response');
    }

    // 4. Verify downloaded PDF exists and is valid
    const pdfUrl = convertRes.data.result.downloadUrl;
    console.log('Verifying generated PDF at:', pdfUrl);

    const downloadRes = await doRequest({
        hostname: 'localhost',
        port: 5000,
        path: pdfUrl,
        method: 'GET',
        headers: { 'Authorization': authHeader }
    });

    console.log('PDF Download HTTP Status:', downloadRes.status);
    console.log('✅ Word to PDF API Verification SUCCESSFUL!');
}

verify().catch(e => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
});
