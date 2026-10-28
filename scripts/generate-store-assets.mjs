/**
 * Google Play listing graphics, from the same owl glyph as the app icon.
 * Usage: npm run store-assets  →  assets/store/
 *
 *   play-icon-512.png       512×512 app icon (Play rounds the corners itself)
 *   feature-graphic.png     1024×500 banner shown at the top of the listing
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const glyph = readFileSync('assets/brand/owl-glyph.svg', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const fontDir = 'node_modules/@expo-google-fonts/plus-jakarta-sans';
const font = {
  fontFiles: [`${fontDir}/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf`, `${fontDir}/500Medium/PlusJakartaSans_500Medium.ttf`],
  loadSystemFonts: false,
  defaultFontFamily: 'Plus Jakarta Sans',
};

const gradient = (w, h) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(${w} ${h})">
      <stop offset="0" stop-color="#7B6CFF"/>
      <stop offset="1" stop-color="#2A1D9E"/>
    </linearGradient>
  </defs>`;

const assets = {
  'assets/store/play-icon-512.png': [
    1024,
    1024,
    512,
    `${gradient(1024, 1024)}<rect width="1024" height="1024" fill="url(#bg)"/>${glyph}`,
  ],
  'assets/store/feature-graphic.png': [
    1024,
    500,
    1024,
    `${gradient(1024, 500)}
     <rect width="1024" height="500" fill="url(#bg)"/>
     <g transform="translate(64 66) scale(0.36)">
       <rect width="1024" height="1024" rx="230" fill="#FFFFFF" fill-opacity="0.10"/>
       ${glyph}
     </g>
     <text x="470" y="215" font-family="Plus Jakarta Sans" font-weight="800" font-size="84" fill="#FFFFFF">WhoOwes</text>
     <text x="472" y="280" font-family="Plus Jakarta Sans" font-weight="500" font-size="30" fill="#E4E0FF">Split bills with friends.</text>
     <text x="472" y="324" font-family="Plus Jakarta Sans" font-weight="500" font-size="30" fill="#E4E0FF">Snap a receipt, AI does the math.</text>
     <rect x="472" y="362" width="96" height="10" rx="5" fill="#D4FF3A"/>`,
  ],
};

mkdirSync('assets/store', { recursive: true });
for (const [file, [w, h, out, body]] of Object.entries(assets)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: out }, font }).render().asPng();
  writeFileSync(file, png);
  console.log(`✓ ${file}`);
}
