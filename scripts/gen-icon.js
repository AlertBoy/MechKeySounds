/**
 * Tray icon: Xiaomi / WeChat-style squircle with vertical blue gradient
 * and a large white "M" (MechKeySounds).
 * Outputs tray.png (22×22) and tray@2x.png (44×44).
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT   = path.join(__dirname, '..');
const OUT_1X = path.join(ROOT, 'resources', 'icons', 'tray.png');
const OUT_2X = path.join(ROOT, 'resources', 'icons', 'tray@2x.png');

// Gradient stops (similar to common app icons: lighter top → deeper blue bottom)
const TOP = { r: 0x4a, g: 0x9e, b: 0xf0 };
const BOTTOM = { r: 0x1e, g: 0x4a, b: 0x8c };

function encodePng(pixels, w, h) {
  const rowLen = w * 4 + 1;
  const raw    = Buffer.alloc(h * rowLen);
  const pixBuf = Buffer.from(pixels.buffer);
  for (let y = 0; y < h; y++) {
    raw[y * rowLen] = 0;
    pixBuf.copy(raw, y * rowLen + 1, y * w * 4, (y + 1) * w * 4);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) {
      c ^= b[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, 'ascii');
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
    return Buffer.concat([lb, tb, data, cb]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))
  ]);
}

function sdfRoundRect(px, py, bx, by, bw, bh, br) {
  const qx = Math.abs(px - (bx + bw / 2)) - bw / 2 + br;
  const qy = Math.abs(py - (by + bh / 2)) - bh / 2 + br;
  const qx2 = Math.max(qx, 0);
  const qy2 = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(qx2, qy2) - br;
}

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  /** Source-over blend, sa in 0..1 */
  blendPixel(x, y, r, g, b, sa) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const Rd = this.data[i], Gd = this.data[i + 1], Bd = this.data[i + 2], Ad = this.data[i + 3] / 255;
    const As = sa;
    if (As <= 0) return;
    const outA = As + Ad * (1 - As);
    if (outA <= 0) return;
    const oR = (r * As + Rd * Ad * (1 - As)) / outA;
    const oG = (g * As + Gd * Ad * (1 - As)) / outA;
    const oB = (b * As + Bd * Ad * (1 - As)) / outA;
    this.data[i]     = Math.round(oR);
    this.data[i + 1] = Math.round(oG);
    this.data[i + 2] = Math.round(oB);
    this.data[i + 3] = Math.round(outA * 255);
  }

  line(x0, y0, x1, y1, weight, r, g, b) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    const nx = -dy / len, ny = dx / len;
    const hw = weight / 2;
    const steps = Math.ceil(len * 4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + dx * t, cy = y0 + dy * t;
      for (let o = -Math.ceil(hw + 1); o <= Math.ceil(hw + 1); o++) {
        const px = cx + nx * o, py = cy + ny * o;
        const d  = Math.abs(o);
        const aa = Math.max(0, 1 - Math.max(0, d - hw));
        if (aa > 0) {
          this.blendPixel(Math.round(px), Math.round(py), r, g, b, aa);
        }
      }
    }
  }

  /** Squircle fill + vertical gradient */
  drawSquircleGradient(bx, by, bw, bh, br) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = sdfRoundRect(x + 0.5, y + 0.5, bx, by, bw, bh, br);
        const edgeAA = Math.max(0, Math.min(1, 0.5 - d));
        if (edgeAA <= 0) continue;
        const t = (y - by) / Math.max(1, bh);
        const r = TOP.r + (BOTTOM.r - TOP.r) * t;
        const g = TOP.g + (BOTTOM.g - TOP.g) * t;
        const bl = TOP.b + (BOTTOM.b - TOP.b) * t;
        this.blendPixel(x, y, r, g, bl, edgeAA);
      }
    }
  }

  /** Large geometric "M" in white */
  drawLetterM(scale) {
    const cx = this.w / 2;
    const top = 7 * scale;
    const bot = this.h - 7 * scale;
    const spread = 11 * scale;
    const midY = top + (bot - top) * 0.55;
    const wStroke = 3.2 * scale;

    const xL = cx - spread;
    const xR = cx + spread;
    this.line(xL, top, xL, bot, wStroke, 255, 255, 255);
    this.line(xR, top, xR, bot, wStroke, 255, 255, 255);
    this.line(xL, top, cx, midY, wStroke, 255, 255, 255);
    this.line(xR, top, cx, midY, wStroke, 255, 255, 255);
  }

  toPng() {
    return encodePng(this.data, this.w, this.h);
  }

  downscale2x() {
    const nw = this.w >> 1, nh = this.h >> 1;
    const out = new Canvas(nw, nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let pr = 0, pg = 0, pb = 0, pa = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const i = ((y * 2 + dy) * this.w + (x * 2 + dx)) * 4;
            const a = this.data[i + 3] / 255;
            pr += this.data[i] * a;
            pg += this.data[i + 1] * a;
            pb += this.data[i + 2] * a;
            pa += a;
          }
        }
        pa /= 4;
        const j = (y * nw + x) * 4;
        if (pa > 0.001) {
          out.data[j]     = Math.round(pr / 4 / pa);
          out.data[j + 1] = Math.round(pg / 4 / pa);
          out.data[j + 2] = Math.round(pb / 4 / pa);
          out.data[j + 3] = Math.round(pa * 255);
        }
      }
    }
    return out;
  }
}

fs.mkdirSync(path.dirname(OUT_1X), { recursive: true });

const W = 44;
const pad = 2;
const c2x = new Canvas(W, W);
c2x.drawSquircleGradient(pad, pad, W - pad * 2, W - pad * 2, 9);
c2x.drawLetterM(1);
fs.writeFileSync(OUT_2X, c2x.toPng());
console.log('Saved', OUT_2X);

const c1x = c2x.downscale2x();
fs.writeFileSync(OUT_1X, c1x.toPng());
console.log('Saved', OUT_1X);
