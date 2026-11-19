const sharp = require('sharp');
const fs = require('fs');

async function generateAllAssets() {
  const masterPath = 'C:/Users/HP/.gemini/antigravity/brain/d2aa01a8-bedf-4944-ba87-d34922b790f3/.user_uploaded/media_1794977978799_c6118bed.png';
  
  if (!fs.existsSync(masterPath)) {
    throw new Error('Master logo not found at: ' + masterPath);
  }

  // 1. Ensure master logo is copied directly to public/logo.png and public/logo-white.png
  fs.copyFileSync(masterPath, 'public/logo.png');
  fs.copyFileSync(masterPath, 'public/logo-white.png');
  fs.copyFileSync(masterPath, 'public/company-logo.png');
  console.log('✓ Master logo copied to public/logo.png, public/logo-white.png, public/company-logo.png');

  // 2. Extract the Scaffolding 'A' mark: { left: 362, top: 44, width: 298, height: 278 }
  const scaffoldRaw = await sharp(masterPath)
    .extract({ left: 362, top: 44, width: 298, height: 278 })
    .toBuffer();

  // Create a version with subtle shadow so it's visible on both dark and light browser tabs
  // For transparent background, we can create a 256x256 canvas
  const size = 256;
  const markSize = 220; // leaves padding
  
  const resizedScaffold = await sharp(scaffoldRaw)
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Create a subtle dark halo/shadow underneath the white scaffolding mark
  // This ensures that if the browser tab is white/light, the mark is clearly defined,
  // and if the browser tab is dark, it looks crisp white with no unwanted box!
  const shadow = await sharp(resizedScaffold)
    .modulate({ brightness: 0 }) // turn to black
    .blur(3)
    .toBuffer();

  const transparentMarkWithShadow = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: shadow, top: 18, left: 18, blend: 'over' },
      { input: shadow, top: 19, left: 19, blend: 'over' },
      { input: resizedScaffold, top: 18, left: 18, blend: 'over' }
    ])
    .png()
    .toBuffer();

  // Save 192x192 logo-icon.png
  await sharp(transparentMarkWithShadow)
    .resize(192, 192)
    .png()
    .toFile('public/logo-icon.png');
  fs.copyFileSync('public/logo-icon.png', 'public/logo-icon-accent.png');
  fs.copyFileSync('public/logo-icon.png', 'public/logo-icon-white.png');
  console.log('✓ public/logo-icon.png generated (transparent with contrast shadow)');

  // Save 32x32 favicon.png
  await sharp(transparentMarkWithShadow)
    .resize(32, 32)
    .png()
    .toFile('public/favicon.png');
  console.log('✓ public/favicon.png generated');

  // Also update src/app/icon.png
  await sharp(transparentMarkWithShadow)
    .resize(192, 192)
    .png()
    .toFile('src/app/icon.png');
  console.log('✓ src/app/icon.png updated');

  // Generate 32x32 favicon.ico
  await sharp(transparentMarkWithShadow)
    .resize(32, 32)
    .png()
    .toFile('public/favicon.ico');
  console.log('✓ public/favicon.ico generated');

  console.log('All favicon and logo assets generated successfully.');
}

generateAllAssets().catch(console.error);
