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
  const ellipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const rotatedEllipse = (x, y, cx, cy, rx, ry, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const dx = x - cx;
    const dy = y - cy;
    const localX = dx * cosine + dy * sine;
    const localY = -dx * sine + dy * cosine;
    return (localX / rx) ** 2 + (localY / ry) ** 2 <= 1;
  };

  const palette = {
    paper: [249, 246, 238, 255],
    ink: [55, 42, 54, 255],
    cream: [247, 207, 153, 255],
    peach: [236, 154, 99, 255],
    vermilion: [205, 97, 69, 255],
    blush: [255, 230, 207, 255]
  };

  function colorAt(x, y) {
    const nx = x / size;
    const ny = y / size;
    const inHead = ellipse(nx, ny, 0.5, 0.51, 0.302, 0.268);
    const inLeftEar = rotatedEllipse(nx, ny, 0.335, 0.325, 0.105, 0.175, -0.43);
    const inRightEar = rotatedEllipse(nx, ny, 0.665, 0.325, 0.105, 0.175, 0.43);
    const inCat = inHead || inLeftEar || inRightEar;
    const inLeftInnerEar = rotatedEllipse(nx, ny, 0.337, 0.31, 0.047, 0.105, -0.43);
    const inRightInnerEar = rotatedEllipse(nx, ny, 0.663, 0.31, 0.047, 0.105, 0.43);
    const patch = rotatedEllipse(nx, ny, 0.615, 0.345, 0.105, 0.072, 0.48) && inCat;
    const muzzle = ellipse(nx, ny, 0.455, 0.59, 0.087, 0.066) || ellipse(nx, ny, 0.545, 0.59, 0.087, 0.066);
    const eyes = ellipse(nx, ny, 0.41, 0.505, 0.018, 0.028)
      || ellipse(nx, ny, 0.59, 0.505, 0.018, 0.028);
    const eyeShine = ellipse(nx, ny, 0.416, 0.496, 0.006, 0.008)
      || ellipse(nx, ny, 0.596, 0.496, 0.006, 0.008);
    const nose = ellipse(nx, ny, 0.5, 0.575, 0.024, 0.017);
    const mouthLeft = nx > 0.455 && nx <= 0.5 && Math.abs(ny - (0.602 + (0.5 - nx) * 0.38)) < 0.005;
    const mouthRight = nx >= 0.5 && nx < 0.545 && Math.abs(ny - (0.602 + (nx - 0.5) * 0.38)) < 0.005;
    const bib = ellipse(nx, ny, 0.5, 0.72, 0.145, 0.075) && ny > 0.685;

    if (eyeShine) return palette.paper;
    if (eyes || mouthLeft || mouthRight) return palette.ink;
    if (nose || bib) return palette.vermilion;
    if (muzzle) return palette.blush;
    if (inLeftInnerEar || inRightInnerEar || patch) return palette.peach;
    if (inCat) return palette.cream;
    return palette.paper;
  }

  for (let y = 0; y < size; y += 1) {
    pixels[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const sum = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < 3; sampleY += 1) {
        for (let sampleX = 0; sampleX < 3; sampleX += 1) {
          const color = colorAt(x + (sampleX + 0.5) / 3, y + (sampleY + 0.5) / 3);
          for (let channel = 0; channel < 4; channel += 1) sum[channel] += color[channel];
        }
      }
      pixels.set(sum.map((value) => Math.round(value / 9)), offset);
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
