#!/usr/bin/env node
// generate-icons.js - Generiere PNG-Icons aus SVG für PWA
// Benötigt: npm install sharp svg2img oder: npx @vscode/svg2png

import { readFileSync } from 'fs';
import { resolve } from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = resolve('icons/icon.svg');

try {
  const svg = readFileSync(svgPath, 'utf-8');
  console.log('SVG geladen. Für PNG-Generierung eine der folgenden Methoden nutzen:');
  console.log('');
  console.log('1. ImageMagick (empfohlen):');
  sizes.forEach(s => {
    console.log(`   magick convert -background none -resize ${s}x${s} icons/icon.svg icons/icon-${s}.png`);
  });
  console.log('');
  console.log('2. Node.js mit sharp:');
  console.log('   npm install sharp');
  console.log('   node -e "require(\'sharp\')(\'icons/icon.svg\').resize(512).png().toFile(\'icons/icon-512.png\')"');
  console.log('');
  console.log('3. Online: https://realfavicongenerator.net/ oder https://www.pwabuilder.com/imageGenerator');
  console.log('');
  console.log('Mindestens icon-192.png und icon-512.png sind für PWA-Installation erforderlich.');
} catch (e) {
  console.error('SVG nicht gefunden:', svgPath);
  process.exit(1);
}