import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL(import.meta.url).pathname, "..", "..");
const SVG_PATH = path.join(ROOT, "public", "dopl-logo.svg");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const PUBLIC_DIR = path.join(ROOT, "public");

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  const svg = await readFile(SVG_PATH);

  await mkdir(ICONS_DIR, { recursive: true });

  for (const size of ICON_SIZES) {
    const out = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`✓ ${out}`);
  }

  // Standalone 512 logo (for share cards / fallback).
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, "dopl-logo.png"));
  console.log("✓ public/dopl-logo.png");

  // apple-touch-icon (180).
  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png"));
  console.log("✓ public/apple-touch-icon.png");

  // favicon.ico — layered PNGs at 16 / 32 / 48, packed into .ico.
  const icoSizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    icoSizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
  );
  const ico = buildIco(pngBuffers, icoSizes);
  await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), ico);
  console.log("✓ public/favicon.ico");
}

// Minimal ICO packer: wraps PNG buffers in the ICO directory format.
function buildIco(pngs, sizes) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageData = [];
  let offset = 6 + count * 16;

  for (let i = 0; i < count; i++) {
    const png = pngs[i];
    const size = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    imageData.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageData]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
