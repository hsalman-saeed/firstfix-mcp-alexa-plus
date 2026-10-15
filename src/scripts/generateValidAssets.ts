import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Computes standard IEEE 802.3 CRC32 checksum for PNG chunks
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a PNG chunk with length, type, data, and CRC32
 */
function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Generates a valid true-dimension solid RGB PNG buffer
 */
export function generateTrueDimensionPng(
  width: number,
  height: number,
  r = 15,
  g = 100,
  b = 200
): Buffer {
  // 8-byte PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (13 bytes)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(2, 9); // Color type 2 (Truecolor RGB)
  ihdrData.writeUInt8(0, 10); // Compression 0
  ihdrData.writeUInt8(0, 11); // Filter 0
  ihdrData.writeUInt8(0, 12); // Interlace 0
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data: height scanlines, each having 1 filter byte (0) + width * 3 bytes (RGB)
  const rowBytes = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData.writeUInt8(0, rowOffset); // filter: 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData.writeUInt8(r, pixelOffset);
      rawData.writeUInt8(g, pixelOffset + 1);
      rawData.writeUInt8(b, pixelOffset + 2);
    }
  }

  // IDAT chunk with zlib compressed scanlines
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

export function generateAllAddonAssets(targetDir = path.resolve(process.cwd(), 'addon-package', 'assets')): void {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const assets = [
    { name: 'icon_64x64.png', width: 64, height: 64 },
    { name: 'icon_72x72.png', width: 72, height: 72 },
    { name: 'icon_88x88.png', width: 88, height: 88 },
    { name: 'icon_126x126.png', width: 126, height: 126 },
    { name: 'icon_180x180.png', width: 180, height: 180 },
    { name: 'icon_241x241.png', width: 241, height: 241 },
    { name: 'carousel_600x900.png', width: 600, height: 900 },
  ];

  for (const asset of assets) {
    const filePath = path.join(targetDir, asset.name);
    const buf = generateTrueDimensionPng(asset.width, asset.height, 22, 119, 255);
    fs.writeFileSync(filePath, buf);
    console.log(`Generated ${asset.name} (${asset.width}x${asset.height}) -> ${buf.length} bytes`);
  }
}

// Allow direct execution
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  generateAllAddonAssets();
}
