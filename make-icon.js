// Pure-Node PNG icon generator (no external dependencies).
// Produces build/icon.png (256), build/tray.png (32), build/badge.png (16).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BUILD_DIR = path.join(__dirname, 'build');

// --- CRC32 (PNG chunk checksums) ---
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
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Encode an RGBA pixel buffer (length w*h*4) into a PNG file buffer.
function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Filtered scanlines (filter type 0 per row).
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Soft coverage: 1 inside, 0 outside, antialiased over ~1px edge.
function cover(signedDist) {
  return Math.max(0, Math.min(1, 0.5 - signedDist));
}

function blend(buf, idx, r, g, b, a) {
  if (a <= 0) return;
  const ia = a / 255;
  const sr = buf[idx], sg = buf[idx + 1], sb = buf[idx + 2], sa = buf[idx + 3] / 255;
  const outA = ia + sa * (1 - ia);
  if (outA <= 0) return;
  buf[idx] = Math.round((r * ia + sr * sa * (1 - ia)) / outA);
  buf[idx + 1] = Math.round((g * ia + sg * sa * (1 - ia)) / outA);
  buf[idx + 2] = Math.round((b * ia + sb * sa * (1 - ia)) / outA);
  buf[idx + 3] = Math.round(outA * 255);
}

// App / tray icon: rounded teal square with a white "Z".
function makeAppIcon(size) {
  const buf = Buffer.alloc(size * size * 4); // transparent
  const radius = size * 0.22;
  const bg = [31, 122, 140];

  const bx1 = size * 0.27, by1 = size * 0.30;
  const bx2 = size * 0.73, by2 = size * 0.70;
  const thick = size * 0.115;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // rounded-rect background mask (signed distance to rounded rect)
      const rx = Math.max(radius - x, x - (size - radius), 0);
      const ry = Math.max(radius - y, y - (size - radius), 0);
      const cornerDist = Math.hypot(rx, ry) - radius;
      const edgeDist = Math.max(
        -x, x - (size - 1), -y, y - (size - 1)
      );
      const bgCover = cover(Math.max(cornerDist, edgeDist));
      if (bgCover > 0) blend(buf, idx, bg[0], bg[1], bg[2], Math.round(255 * bgCover));

      // white "Z": three thick segments
      const cx = x + 0.5, cy = y + 0.5;
      const dTop = distToSegment(cx, cy, bx1, by1, bx2, by1);
      const dDiag = distToSegment(cx, cy, bx2, by1, bx1, by2);
      const dBot = distToSegment(cx, cy, bx1, by2, bx2, by2);
      const dZ = Math.min(dTop, dDiag, dBot) - thick / 2;
      const zCover = cover(dZ) * bgCover;
      if (zCover > 0) blend(buf, idx, 255, 255, 255, Math.round(255 * zCover));
    }
  }
  return encodePng(size, size, buf);
}

// Unread badge: solid red circle (taskbar overlay).
function makeBadge(size) {
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const r = size * 0.46;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const d = Math.hypot(x - c, y - c) - r;
      const cv = cover(d);
      if (cv > 0) blend(buf, idx, 226, 59, 59, Math.round(255 * cv));
    }
  }
  return encodePng(size, size, buf);
}

fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), makeAppIcon(256));
fs.writeFileSync(path.join(BUILD_DIR, 'tray.png'), makeAppIcon(32));
fs.writeFileSync(path.join(BUILD_DIR, 'badge.png'), makeBadge(16));
console.log('Icons generated in build/');
