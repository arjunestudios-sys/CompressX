const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateAssets() {
    const svgPath = path.join(__dirname, '../frontend/assets/logo.svg');
    const resourcesDir = path.join(__dirname, '../resources');
    const assetsDir = path.join(__dirname, '../assets');

    if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const svgBuffer = fs.readFileSync(svgPath);

    console.log('Generating Capacitor app icon (1024x1024)...');
    await sharp(svgBuffer)
        .resize(1024, 1024)
        .png()
        .toFile(path.join(resourcesDir, 'icon.png'));

    await sharp(svgBuffer)
        .resize(1024, 1024)
        .png()
        .toFile(path.join(assetsDir, 'icon.png'));

    console.log('Generating Capacitor splash screen (2732x2732)...');
    // Create centered logo on dark background (#0b0f19)
    const logoResized = await sharp(svgBuffer).resize(600, 600).toBuffer();
    await sharp({
        create: {
            width: 2732,
            height: 2732,
            channels: 4,
            background: { r: 11, g: 15, b: 25, alpha: 1 }
        }
    })
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toFile(path.join(resourcesDir, 'splash.png'));

    await sharp({
        create: {
            width: 2732,
            height: 2732,
            channels: 4,
            background: { r: 11, g: 15, b: 25, alpha: 1 }
        }
    })
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

    console.log('? Generated resources/icon.png and resources/splash.png successfully!');
}

generateAssets().catch(err => {
    console.error('Error generating assets:', err);
    process.exit(1);
});
