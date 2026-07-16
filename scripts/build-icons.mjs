import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = path.join(root, 'assets', 'icons');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return output;
}

function makeIcon(size) {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(stride * size);
  const center = (size - 1) / 2;
  const pointInTriangle = (px, py, [ax, ay], [bx, by], [cx, cy]) => {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNegative && hasPositive);
  };

  const leftEar = [
    [size * 0.22, size * 0.43],
    [size * 0.29, size * 0.18],
    [size * 0.48, size * 0.38]
  ];
  const rightEar = leftEar.map(([x, y]) => [size - x, y]);
  const leftInnerEar = [
    [size * 0.285, size * 0.36],
    [size * 0.31, size * 0.245],
    [size * 0.405, size * 0.36]
  ];
  const rightInnerEar = leftInnerEar.map(([x, y]) => [size - x, y]);

  for (let y = 0; y < size; y += 1) {
    pixels[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const nx = (x - center) / (size * 0.355);
      const ny = (y - size * 0.545) / (size * 0.305);
      const inHead = nx * nx + ny * ny < 1;
      const inLeftEar = pointInTriangle(x, y, ...leftEar);
      const inRightEar = pointInTriangle(x, y, ...rightEar);
      const inInnerEar = pointInTriangle(x, y, ...leftInnerEar)
        || pointInTriangle(x, y, ...rightInnerEar);
      const eyeY = size * 0.51;
      const leftEye = Math.hypot((x - size * 0.41) / 0.65, y - eyeY) < size * 0.024;
      const rightEye = Math.hypot((x - size * 0.59) / 0.65, y - eyeY) < size * 0.024;
      const nose = Math.hypot(x - center, (y - size * 0.61) * 1.35) < size * 0.028;
      const muzzleLeft = Math.hypot(x - size * 0.46, y - size * 0.655) < size * 0.068;
      const muzzleRight = Math.hypot(x - size * 0.54, y - size * 0.655) < size * 0.068;
      const star = ((x * 17 + y * 29) % 997 === 0) && Math.hypot(x - center, y - center) > size * 0.34;

      const color = leftEye || rightEye
        ? [35, 29, 51, 255]
        : nose
          ? [237, 139, 177, 255]
          : muzzleLeft || muzzleRight
            ? [255, 237, 207, 255]
            : inInnerEar
              ? [237, 139, 177, 255]
              : inHead || inLeftEar || inRightEar
                ? [201, 176, 255, 255]
                : star
                  ? [255, 237, 207, 155]
                  : [15, 17, 31, 255];

      pixels.set(color, offset);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

await mkdir(iconDir, { recursive: true });
await Promise.all([
  writeFile(path.join(iconDir, 'icon-192.png'), makeIcon(192)),
  writeFile(path.join(iconDir, 'icon-512.png'), makeIcon(512)),
  writeFile(path.join(iconDir, 'apple-touch-icon.png'), makeIcon(180))
]);

console.log('Đã tạo icon PWA 180/192/512 px.');
