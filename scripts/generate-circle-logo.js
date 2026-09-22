const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function makeCircleLogo() {
    const inputImagePath = 'C:\\Users\\arjun\\.gemini\\antigravity-ide\\brain\\c51d9352-66a6-4c9e-ac3a-bb0f1427879e\\.user_uploaded\\media_1790052315273.jpg';
    const frontendAssetsDir = path.join(__dirname, '../frontend/assets');

    const inputBuffer = fs.readFileSync(inputImagePath);
    const metadata = await sharp(inputBuffer).metadata();

    // 1. Crop the top 3D D-folder icon
    const cropHeight = Math.floor(metadata.height * 0.78);
    const croppedBuffer = await sharp(inputBuffer)
        .extract({
            left: 0,
            top: 0,
            width: metadata.width,
            height: cropHeight
        })
        .resize(512, 512, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 1 } })
        .png()
        .toBuffer();

    // 2. Create circular mask SVG
    const circleMask = Buffer.from(
        '<svg width="512" height="512"><circle cx="256" cy="256" r="256" fill="#fff" /></svg>'
    );

    // 3. Composite with circle mask for perfect transparent circular badge
    const circularLogo = await sharp(croppedBuffer)
        .composite([{
            input: circleMask,
            blend: 'dest-in'
        }])
        .png()
        .toBuffer();

    fs.writeFileSync(path.join(frontendAssetsDir, 'logo-circle.png'), circularLogo);
    fs.writeFileSync(path.join(frontendAssetsDir, 'logo-icon.png'), circularLogo);

    // Also create full circular version of original (including text or full frame)
    const fullCircle = await sharp(inputBuffer)
        .resize(512, 512, { fit: 'cover' })
        .composite([{
            input: circleMask,
            blend: 'dest-in'
        }])
        .png()
        .toBuffer();

    fs.writeFileSync(path.join(frontendAssetsDir, 'logo-full-circle.png'), fullCircle);

    console.log('✅ Generated logo-circle.png, logo-icon.png, and logo-full-circle.png successfully!');
}

makeCircleLogo().catch(console.error);
