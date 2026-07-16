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
  const sealRadius = size * 0.31;

  for (let y = 0; y < size; y += 1) {
    pixels[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const distance = Math.hypot(x - center, y - center);
      const inSeal = distance < sealRadius;
      const inInner = distance < sealRadius * 0.83;
      const verticalStroke = Math.abs(x - center) < size * 0.035 && Math.abs(y - center) < size * 0.16;
      const topStroke = Math.abs(y - (center - size * 0.17)) < size * 0.025 && Math.abs(x - center) < size * 0.13;
      const bottomStroke = Math.abs(y - (center + size * 0.17)) < size * 0.025 && Math.abs(x - center) < size * 0.13;
      const glyph = inInner && (verticalStroke || topStroke || bottomStroke);

      const color = glyph
        ? [246, 241, 230, 255]
        : inSeal
          ? [217, 70, 52, 255]
          : [24, 25, 24, 255];

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
