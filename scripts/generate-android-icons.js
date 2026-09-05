const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function buildAndroidIcons() {
    const svgPath = path.join(__dirname, '../frontend/assets/logo.svg');
    const resDir = path.join(__dirname, '../android/app/src/main/res');

    if (!fs.existsSync(resDir)) {
        console.error('Android res directory not found at:', resDir);
        return;
    }

    const svgBuffer = fs.readFileSync(svgPath);

    const iconSizes = [
        { folder: 'mipmap-mdpi', size: 48 },
        { folder: 'mipmap-hdpi', size: 72 },
        { folder: 'mipmap-xhdpi', size: 96 },
        { folder: 'mipmap-xxhdpi', size: 144 },
        { folder: 'mipmap-xxxhdpi', size: 192 },
    ];

    for (const item of iconSizes) {
        const targetDir = path.join(resDir, item.folder);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        await sharp(svgBuffer)
            .resize(item.size, item.size)
            .png()
            .toFile(path.join(targetDir, 'ic_launcher.png'));

        await sharp(svgBuffer)
            .resize(item.size, item.size)
            .png()
            .toFile(path.join(targetDir, 'ic_launcher_round.png'));

        await sharp(svgBuffer)
            .resize(item.size, item.size)
            .png()
            .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

        console.log('Built ' + item.folder + ' (' + item.size + 'x' + item.size + ')');
    }

    console.log('All Android icons generated successfully!');
}

buildAndroidIcons().catch(console.error);
