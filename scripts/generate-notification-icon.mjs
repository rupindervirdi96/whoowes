/**
 * Android notification icon: the owl as a white silhouette on transparent
 * (Android tints it and ignores colors). Usage: node scripts/generate-notification-icon.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

// The owl glyph from assets/brand/owl-glyph.svg with the dark pupils cut out.
const eye = (cx, whiteHalf) => {
  const r = 158;
  const hole = 87; // outer edge of the pupil ring
  const half = 65; // inner edge of the ring
  const ring = `M${cx - r} 576a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z M${cx - hole} 576a${hole} ${hole} 0 1 0 ${2 * hole} 0a${hole} ${hole} 0 1 0 ${-2 * hole} 0Z`;
  // The light half of the "split coin" pupil.
  const sweep = whiteHalf === 'left' ? 0 : 1;
  const coin = `M${cx} ${576 - half} A${half} ${half} 0 0 ${sweep} ${cx} ${576 + half} Z`;
  return `<path fill="#fff" fill-rule="evenodd" d="${ring}"/><path fill="#fff" d="${coin}"/>`;
};

const body = `
  <path d="M196 300 L364 418 L512 340 L660 418 L828 300" fill="none" stroke="#fff" stroke-width="78" stroke-linecap="round" stroke-linejoin="round"/>
  ${eye(364, 'left')}
  ${eye(660, 'right')}
  <path d="M474 748 L550 748 L512 812 Z" fill="#fff" stroke="#fff" stroke-width="22" stroke-linejoin="round"/>`;

// A little padding so the shape isn't cropped in the status bar.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 140 864 760">${body}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 96 }, background: 'rgba(0,0,0,0)' }).render().asPng();
writeFileSync('assets/notification-icon.png', png);
console.log('✓ assets/notification-icon.png (96px)');
