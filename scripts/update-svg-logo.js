const fs = require('fs');
const path = require('path');

const logoPngPath = path.join(__dirname, '../frontend/assets/logo.png');
const logoSvgPath = path.join(__dirname, '../frontend/assets/logo.svg');

const pngBuffer = fs.readFileSync(logoPngPath);
const base64Png = pngBuffer.toString('base64');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" width="100%" height="100%">
  <defs>
    <clipPath id="docholderRadius">
      <rect width="1024" height="1024" rx="160" ry="160" />
    </clipPath>
  </defs>
  <image href="data:image/png;base64,${base64Png}" xlink:href="data:image/png;base64,${base64Png}" width="1024" height="1024" />
</svg>
`;

fs.writeFileSync(logoSvgPath, svgContent);
console.log('✅ Updated frontend/assets/logo.svg with the new master Docholder artwork');
