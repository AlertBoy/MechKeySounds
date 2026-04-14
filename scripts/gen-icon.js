/**
 * Renders tray.svg → tray@1x.png (22×22) and tray@2x.png (44×44)
 * using Node.js + the system `rsvg-convert` or `convert` (ImageMagick),
 * with a pure-JS fallback that embeds the SVG into an HTML canvas via
 * the Chromium renderer (run with `electron scripts/gen-icon.js`).
 *
 * Usage:  node scripts/gen-icon.js
 *   OR:   electron scripts/gen-icon.js
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const { execSync } = require('child_process');

const ROOT    = path.join(__dirname, '..');
const SVG_IN  = path.join(ROOT, 'resources', 'icons', 'tray.svg');
const OUT_1X  = path.join(ROOT, 'resources', 'icons', 'tray.png');
const OUT_2X  = path.join(ROOT, 'resources', 'icons', 'tray@2x.png');

// ── try rsvg-convert (homebrew librsvg) ───────────────────────────────────
function tryRsvg() {
  try {
    execSync(`which rsvg-convert`, { stdio: 'ignore' });
    execSync(`rsvg-convert -w 22 -h 22 "${SVG_IN}" -o "${OUT_1X}"`);
    execSync(`rsvg-convert -w 44 -h 44 "${SVG_IN}" -o "${OUT_2X}"`);
    return true;
  } catch { return false; }
}

// ── try ImageMagick / GraphicsMagick ─────────────────────────────────────
function tryImageMagick() {
  try {
    execSync(`which convert`, { stdio: 'ignore' });
    execSync(`convert -background none -resize 22x22 "${SVG_IN}" "${OUT_1X}"`);
    execSync(`convert -background none -resize 44x44 "${SVG_IN}" "${OUT_2X}"`);
    return true;
  } catch { return false; }
}

// ── try Inkscape ─────────────────────────────────────────────────────────
function tryInkscape() {
  try {
    execSync(`which inkscape`, { stdio: 'ignore' });
    execSync(`inkscape --export-type=png --export-width=22 --export-filename="${OUT_1X}" "${SVG_IN}"`);
    execSync(`inkscape --export-type=png --export-width=44 --export-filename="${OUT_2X}" "${SVG_IN}"`);
    return true;
  } catch { return false; }
}

// ── pure JS fallback: hand-crafted PNG of the keyboard icon ───────────────
// Encodes a 44×44 RGBA PNG entirely in Node.js (no native deps).
function generateFallbackPng() {
  const zlib = require('zlib');

  const W = 44, H = 44;
  const pixels = new Uint8Array(W * H * 4); // RGBA

  function px(x, y, a = 255) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 4;
    pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = a;
  }

  // Anti-aliased line helper (Xiaopeng / Wu line algorithm approx)
  function line(x0, y0, x1, y1, w = 1.4) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t  = s / steps;
      const cx = x0 + dx * t;
      const cy = y0 + dy * t;
      for (let oy = -Math.ceil(w); oy <= Math.ceil(w); oy++) {
        for (let ox = -Math.ceil(w); ox <= Math.ceil(w); ox++) {
          const d = Math.hypot(ox, oy);
          if (d <= w / 2) {
            const aa = Math.max(0, 1 - Math.max(0, d - w / 2 + 0.5));
            const xi = Math.round(cx + ox);
            const yi = Math.round(cy + oy);
            if (xi >= 0 && xi < W && yi >= 0 && yi < H) {
              const i = (yi * W + xi) * 4;
              const prev = pixels[i + 3];
              pixels[i+3] = Math.min(255, prev + Math.round(aa * 255));
            }
          }
        }
      }
    }
  }

  // Filled rounded rect helper
  function roundedRect(x, y, w, h, r, fill = false, strokeW = 1.4) {
    if (fill) {
      for (let ry = y; ry <= y + h; ry++) {
        for (let rx = x; rx <= x + w; rx++) {
          // corner tests
          const inBL = rx - x < r     && ry - y < r;
          const inBR = x + w - rx < r && ry - y < r;
          const inTL = rx - x < r     && y + h - ry < r;
          const inTR = x + w - rx < r && y + h - ry < r;
          let inside = true;
          if (inBL && Math.hypot(rx - (x + r), ry - (y + r)) > r) inside = false;
          if (inBR && Math.hypot(rx - (x + w - r), ry - (y + r)) > r) inside = false;
          if (inTL && Math.hypot(rx - (x + r), ry - (y + h - r)) > r) inside = false;
          if (inTR && Math.hypot(rx - (x + w - r), ry - (y + h - r)) > r) inside = false;
          if (inside) px(Math.round(rx), Math.round(ry));
        }
      }
    } else {
      // stroke only – draw 4 edges + arc corners
      line(x + r, y,         x + w - r, y,         strokeW);
      line(x + r, y + h,     x + w - r, y + h,     strokeW);
      line(x,     y + r,     x,         y + h - r,  strokeW);
      line(x + w, y + r,     x + w,     y + h - r,  strokeW);
      // corners
      const ARC = 12;
      for (let a = 0; a <= ARC; a++) {
        const ang  = (Math.PI / 2) * (a / ARC);
        const cosa = Math.cos(ang), sina = Math.sin(ang);
        const pts = [
          [x + r - r * cosa,     y + r - r * sina    ],
          [x + w - r + r * cosa, y + r - r * sina    ],
          [x + r - r * cosa,     y + h - r + r * sina],
          [x + w - r + r * cosa, y + h - r + r * sina],
        ];
        pts.forEach(([px2, py2]) => {
          const aa = 200;
          const xi = Math.round(px2), yi = Math.round(py2);
          if (xi >= 0 && xi < W && yi >= 0 && yi < H) {
            const i = (yi * W + xi) * 4;
            pixels[i+3] = Math.min(255, pixels[i+3] + aa);
          }
        });
      }
    }
  }

  // Scale factor: design coords are 22×22, output is 44×44
  const S = 2;

  // Keyboard body outline
  roundedRect(1.5*S, 4.5*S, 19*S, 13*S, 2.5*S, false, 1.5);

  // Helper: filled key
  function key(x, y, w, h) {
    roundedRect(x * S, y * S, w * S, h * S, 0.5 * S, true);
  }

  // Row 1
  key(3,    6.8, 2.4, 1.9);
  key(6.4,  6.8, 2.4, 1.9);
  key(9.8,  6.8, 2.4, 1.9);
  key(13.2, 6.8, 2.4, 1.9);
  key(16.6, 6.8, 1.9, 1.9);

  // Row 2
  key(3.5,  9.6, 2.4, 1.9);
  key(6.9,  9.6, 2.4, 1.9);
  key(10.3, 9.6, 2.4, 1.9);
  key(13.7, 9.6, 2.4, 1.9);

  // Spacebar
  key(5.5, 12.6, 11, 1.8);

  // ── encode PNG ───────────────────────────────────────────────────────
  function encodePng(data, w, h) {
    const rowLen  = w * 4 + 1;
    const raw     = Buffer.alloc(h * rowLen);
    for (let y2 = 0; y2 < h; y2++) {
      raw[y2 * rowLen] = 0; // filter: None
      data.copy(raw, y2 * rowLen + 1, y2 * w * 4, (y2 + 1) * w * 4);
    }
    const compressed = zlib.deflateSync(raw);
    const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
    ihdr[8]=8; ihdr[9]=6; // 8-bit RGBA
    function chunk(type, d) {
      const len=Buffer.alloc(4); len.writeUInt32BE(d.length,0);
      const tb=Buffer.from(type); const cd=Buffer.concat([tb,d]);
      let crc=0xFFFFFFFF;
      for(let b=0;b<cd.length;b++){crc^=cd[b];for(let j=0;j<8;j++)crc=(crc>>>1)^(crc&1?0xEDB88320:0);}
      const cc=Buffer.alloc(4); cc.writeUInt32BE((crc^0xFFFFFFFF)>>>0,0);
      return Buffer.concat([len,tb,d,cc]);
    }
    return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',compressed), chunk('IEND',Buffer.alloc(0))]);
  }

  const buf = Buffer.from(pixels);
  fs.writeFileSync(OUT_2X, encodePng(buf, W, H));

  // Downscale 2× to 1×
  const px1 = new Uint8Array(22 * 22 * 4);
  for (let y2 = 0; y2 < 22; y2++) {
    for (let x2 = 0; x2 < 22; x2++) {
      let a = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const si = ((y2*2+dy)*44+(x2*2+dx))*4;
          a += pixels[si+3];
        }
      }
      const di = (y2*22+x2)*4;
      px1[di+3] = Math.min(255, Math.round(a/4));
    }
  }
  fs.writeFileSync(OUT_1X, encodePng(Buffer.from(px1), 22, 22));

  console.log('Generated fallback PNG icons');
  return true;
}

// ── run ───────────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(OUT_1X), { recursive: true });

if      (tryRsvg())        console.log('Icon generated via rsvg-convert');
else if (tryImageMagick()) console.log('Icon generated via ImageMagick');
else if (tryInkscape())    console.log('Icon generated via Inkscape');
else                       generateFallbackPng();

console.log('Output:', OUT_1X, OUT_2X);
