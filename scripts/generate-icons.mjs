/**
 * Generates the PWA icons from an inline SVG: a stylized RAM column
 * with process-colored blocks and one hatched free block.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

// maskable = true renders a full-bleed square with extra safe-area padding.
const svg = (maskable) => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${maskable ? 0 : 116}" fill="#14161f"/>
  <g transform="translate(${maskable ? 176 : 146}, ${maskable ? 141 : 96}) scale(${maskable ? 0.72 : 1})">
    <rect x="0" y="0" width="220" height="320" rx="28" fill="#1d2130" stroke="#2c3245" stroke-width="6"/>
    <rect x="24" y="24" width="172" height="86" rx="12" fill="#5B8DEF"/>
    <rect x="24" y="122" width="172" height="56" rx="12" fill="#F2A65A"/>
    <rect x="24" y="190" width="172" height="40" rx="12" fill="#232838"/>
    <line x1="34" y1="226" x2="66" y2="194" stroke="#4a5168" stroke-width="5"/>
    <line x1="66" y1="226" x2="98" y2="194" stroke="#4a5168" stroke-width="5"/>
    <line x1="98" y1="226" x2="130" y2="194" stroke="#4a5168" stroke-width="5"/>
    <line x1="130" y1="226" x2="162" y2="194" stroke="#4a5168" stroke-width="5"/>
    <rect x="24" y="242" width="172" height="54" rx="12" fill="#7DD3C0"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });

await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");

console.log("icons written");
