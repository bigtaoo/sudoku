// Renders the app icons in public/ from one SVG design. Run after changing the design:
//   pnpm --filter @sudoku/web icons
// The digit is drawn with paths (not <text>) so rendering doesn't depend on installed fonts.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BG = '#2457c5';

/** @param {{ rounded: boolean }} opts Maskable icons must be full-bleed; the OS applies the mask. */
function svg({ rounded }) {
  const r = rounded ? 104 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><clipPath id="c"><rect width="512" height="512" rx="${r}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="512" height="512" fill="${BG}"/>
    <path d="M171 0v512M341 0v512M0 171h512M0 341h512" stroke="#fff" stroke-opacity=".5" stroke-width="12"/>
    <g fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round">
      <circle cx="256" cy="228" r="40"/>
      <path d="M296 228v38c0 34-22 52-58 52"/>
    </g>
  </g>
</svg>
`;
}

const out = new URL('../public/', import.meta.url);
const rounded = Buffer.from(svg({ rounded: true }));
const square = Buffer.from(svg({ rounded: false }));

await writeFile(new URL('favicon.svg', out), rounded);
const png = (src, size, name) =>
  sharp(src, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, out)));

await Promise.all([
  png(rounded, 192, 'pwa-192x192.png'),
  png(rounded, 512, 'pwa-512x512.png'),
  png(square, 512, 'maskable-512x512.png'),
  // iOS rounds the corners itself and shows transparency as black.
  png(square, 180, 'apple-touch-icon.png'),
  png(rounded, 32, 'favicon-32x32.png'),
]);
console.log('icons written to public/');
