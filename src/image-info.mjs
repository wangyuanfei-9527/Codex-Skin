import fs from 'node:fs/promises';
import path from 'node:path';
import { PET_HEIGHT, PET_MAX_BYTES, PET_WIDTH } from './constants.mjs';

function pngInfo(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 33 || buffer.subarray(0, 8).toString('hex') !== signature) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  let offset = 8;
  let transparent = colorType === 4 || colorType === 6;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'tRNS') transparent = true;
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return { format: 'png', width, height, transparent };
}

function webpInfo(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      format: 'webp',
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
      transparent: Boolean(buffer[20] & 0x10),
    };
  }
  if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      format: 'webp',
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      transparent: Boolean((bits >> 28) & 1),
    };
  }
  return { format: 'webp', width: null, height: null, transparent: false };
}

export async function inspectImage(filePath) {
  const buffer = await fs.readFile(filePath);
  const info = pngInfo(buffer) || webpInfo(buffer);
  if (!info) throw new Error(`Unsupported image format: ${path.basename(filePath)} (expected PNG or WebP)`);
  return { ...info, bytes: buffer.length };
}

export async function validatePetSpritesheet(filePath) {
  const info = await inspectImage(filePath);
  const errors = [];
  if (info.bytes > PET_MAX_BYTES) errors.push('spritesheet exceeds 20 MiB');
  if (info.width !== PET_WIDTH || info.height !== PET_HEIGHT) errors.push(`spritesheet must be exactly ${PET_WIDTH}x${PET_HEIGHT}`);
  if (!info.transparent) errors.push('spritesheet must contain an alpha channel or transparency metadata');
  if (errors.length) throw new Error(`Invalid pet spritesheet:\n- ${errors.join('\n- ')}`);
  return info;
}
