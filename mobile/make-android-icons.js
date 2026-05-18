// Self-contained PNG launcher-icon generator for Android (no dependencies).
// Renders the same teal "Z" icon at all required mipmap densities.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.alloc(4);
  l.writeUInt32BE(data.length, 0);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([l, t, data, c]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const cover = (d) => Math.max(0, Math.min(1, 0.5 - d));
function blend(buf, i, r, g, b, a) {
  if (a <= 0) return;
  const ia = a / 255, sa = buf[i + 3] / 255;
  const oa = ia + sa * (1 - ia);
  if (oa <= 0) return;
  buf[i] = Math.round((r * ia + buf[i] * sa * (1 - ia)) / oa);
  buf[i + 1] = Math.round((g * ia + buf[i + 1] * sa * (1 - ia)) / oa);
  buf[i + 2] = Math.round((b * ia + buf[i + 2] * sa * (1 - ia)) / oa);
  buf[i + 3] = Math.round(oa * 255);
}
function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.5; // round-friendly: full circle background
  const bg = [31, 122, 140];
  const bx1 = size * 0.27, by1 = size * 0.3, bx2 = size * 0.73, by2 = size * 0.7;
  const thick = size * 0.115;
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const bgCover = cover(Math.hypot(x - c, y - c) - radius * 0.98);
      if (bgCover > 0) blend(buf, idx, bg[0], bg[1], bg[2], Math.round(255 * bgCover));
      const cx = x + 0.5, cy = y + 0.5;
      const dZ =
        Math.min(
          distToSegment(cx, cy, bx1, by1, bx2, by1),
          distToSegment(cx, cy, bx2, by1, bx1, by2),
          distToSegment(cx, cy, bx1, by2, bx2, by2)
        ) - thick / 2;
      const zc = cover(dZ) * bgCover;
      if (zc > 0) blend(buf, idx, 255, 255, 255, Math.round(255 * zc));
    }
  }
  return encodePng(size, size, buf);
}

const DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};
const RES = path.join(__dirname, 'app', 'src', 'main', 'res');
for (const [dir, size] of Object.entries(DENSITIES)) {
  const out = path.join(RES, dir);
  fs.mkdirSync(out, { recursive: true });
  const png = makeIcon(size);
  fs.writeFileSync(path.join(out, 'ic_launcher.png'), png);
  fs.writeFileSync(path.join(out, 'ic_launcher_round.png'), png);
}
console.log('Android launcher icons generated.');
