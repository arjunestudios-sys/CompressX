const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function processLogo() {
    const inputImagePath = 'C:\\Users\\arjun\\.gemini\\antigravity-ide\\brain\\c51d9352-66a6-4c9e-ac3a-bb0f1427879e\\.user_uploaded\\media_1790052315273.jpg';

    if (!fs.existsSync(inputImagePath)) {
        throw new Error('Input logo file not found at: ' + inputImagePath);
    }

    console.log('Reading input logo:', inputImagePath);
    const inputBuffer = fs.readFileSync(inputImagePath);
    const metadata = await sharp(inputBuffer).metadata();
    console.log(`Input dimensions: ${metadata.width}x${metadata.height}`);

    const frontendAssetsDir = path.join(__dirname, '../frontend/assets');
    const resourcesDir = path.join(__dirname, '../resources');
    const assetsDir = path.join(__dirname, '../assets');
    const androidResDir = path.join(__dirname, '../android/app/src/main/res');

    [frontendAssetsDir, resourcesDir, assetsDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // 1. Save master high-res copies
    const masterFullLogo = await sharp(inputBuffer)
        .resize(1024, 1024, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 1 } })
        .png()
        .toBuffer();

    // 2. Crop top icon mark (D-folder) for compact icons (clean square icon)
    // The top icon is roughly in the top 80% of the image
    const iconOnly = await sharp(inputBuffer)
        .extract({
            left: 0,
            top: 0,
            width: metadata.width,
            height: Math.floor(metadata.height * 0.78)
        })
        .resize(1024, 1024, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 1 } })
        .png()
        .toBuffer();

    // Save full logo and icon to frontend assets
    fs.writeFileSync(path.join(frontendAssetsDir, 'logo.png'), masterFullLogo);
    fs.writeFileSync(path.join(frontendAssetsDir, 'logo-icon.png'), iconOnly);
    fs.writeFileSync(path.join(frontendAssetsDir, 'logo-source.png'), inputBuffer);

    // Save favicons
    await sharp(iconOnly).resize(192, 192).png().toFile(path.join(frontendAssetsDir, 'favicon-192.png'));
    await sharp(iconOnly).resize(512, 512).png().toFile(path.join(frontendAssetsDir, 'favicon-512.png'));
    await sharp(iconOnly).resize(64, 64).png().toFile(path.join(frontendAssetsDir, 'favicon.png'));

    // Save resources / assets for Capacitor
    fs.writeFileSync(path.join(resourcesDir, 'icon.png'), masterFullLogo);
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), masterFullLogo);

    // 3. Splash Screen (2732x2732)
    console.log('Generating Splash screens...');
    const splashLogo = await sharp(inputBuffer)
        .resize(900, 900, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 1 } })
        .toBuffer();

    const splash2732 = await sharp({
        create: {
            width: 2732,
            height: 2732,
            channels: 4,
            background: { r: 11, g: 15, b: 25, alpha: 1 }
        }
    })
    .composite([{ input: splashLogo, gravity: 'center' }])
    .png()
    .toBuffer();

    fs.writeFileSync(path.join(resourcesDir, 'splash.png'), splash2732);
    fs.writeFileSync(path.join(assetsDir, 'splash.png'), splash2732);

    // 4. Generate Android mipmaps & adaptive icons
    if (fs.existsSync(androidResDir)) {
        console.log('Updating Android mipmaps & drawables...');
        const mipmapSizes = [
            { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
            { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
            { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
            { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
            { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
        ];

        for (const item of mipmapSizes) {
            const targetFolder = path.join(androidResDir, item.folder);
            if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

            // Standard launcher icon
            await sharp(masterFullLogo)
                .resize(item.size, item.size)
                .png()
                .toFile(path.join(targetFolder, 'ic_launcher.png'));

            // Round launcher icon
            await sharp(masterFullLogo)
                .resize(item.size, item.size)
                .png()
                .toFile(path.join(targetFolder, 'ic_launcher_round.png'));

            // Adaptive icon foreground (centered with safe padding)
            const safeContentSize = Math.floor(item.fgSize * 0.72);
            const fgIcon = await sharp(masterFullLogo)
                .resize(safeContentSize, safeContentSize, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 0 } })
                .toBuffer();

            await sharp({
                create: {
                    width: item.fgSize,
                    height: item.fgSize,
                    channels: 4,
                    background: { r: 11, g: 15, b: 25, alpha: 0 }
                }
            })
            .composite([{ input: fgIcon, gravity: 'center' }])
            .png()
            .toFile(path.join(targetFolder, 'ic_launcher_foreground.png'));
        }

        // Generate Android splash drawables
        const splashDrawables = [
            { folder: 'drawable', width: 480, height: 800 },
            { folder: 'drawable-port-mdpi', width: 320, height: 480 },
            { folder: 'drawable-port-hdpi', width: 480, height: 800 },
            { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
            { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
            { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
            { folder: 'drawable-land-mdpi', width: 480, height: 320 },
            { folder: 'drawable-land-hdpi', width: 800, height: 480 },
            { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
            { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
            { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
        ];

        for (const item of splashDrawables) {
            const targetFolder = path.join(androidResDir, item.folder);
            if (fs.existsSync(targetFolder)) {
                const targetLogoSize = Math.min(Math.floor(Math.min(item.width, item.height) * 0.5), 500);
                const resizedLogo = await sharp(inputBuffer)
                    .resize(targetLogoSize, targetLogoSize, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 1 } })
                    .toBuffer();

                await sharp({
                    create: {
                        width: item.width,
                        height: item.height,
                        channels: 4,
                        background: { r: 11, g: 15, b: 25, alpha: 1 }
                    }
                })
                .composite([{ input: resizedLogo, gravity: 'center' }])
                .png()
                .toFile(path.join(targetFolder, 'splash.png'));
            }
        }
    }

    console.log('✅ All Docholder logo assets, app icons, favicons, and splash screens generated successfully!');
}

processLogo().catch(err => {
    console.error('Failed to process logo:', err);
    process.exit(1);
});
