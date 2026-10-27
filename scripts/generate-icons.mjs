/**
 * Regenerates every app icon / splash / favicon PNG from assets/brand/owl-glyph.svg.
 * Usage: npm run icons
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const glyph = readFileSync('assets/brand/owl-glyph.svg', 'utf8').replace(/<!--[\s\S]*?-->/g, '');

const gradient = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7B6CFF"/>
      <stop offset="1" stop-color="#4129D6"/>
    </linearGradient>
  </defs>`;

// Scales the glyph around the artboard center (used to fit Android's adaptive-icon safe zone).
const scaled = (s) => `<g transform="translate(${512 * (1 - s)} ${512 * (1 - s)}) scale(${s})">${glyph}</g>`;

const svgs = {
  // Full-bleed square: iOS and stores apply their own corner mask.
  'assets/icon.png': [1024, `${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${glyph}`],
  // Android adaptive foreground: transparent, glyph inside the 66% safe zone.
  'assets/adaptive-icon.png': [1024, scaled(0.62)],
  // Rounded badge used by the splash screen and web favicon.
  'assets/splash-icon.png': [1024, `${gradient}<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${glyph}`],
  'assets/favicon.png': [48, `${gradient}<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${glyph}`],
};

for (const [file, [size, body]] of Object.entries(svgs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng();
  writeFileSync(file, png);
  console.log(`✓ ${file} (${size}px)`);
}

// Standalone SVG of the badge, handy for the website / docs.
writeFileSync(
  'assets/brand/logo-badge.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${gradient}<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${glyph}</svg>\n`,
);
console.log('✓ assets/brand/logo-badge.svg');
