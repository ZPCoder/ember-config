import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const [, , sourceArg, destinationArg] = process.argv;

if (!sourceArg || !destinationArg) {
  throw new Error(
    "Usage: node scripts/process-card-art.mjs <source-image> <destination.webp>",
  );
}

const source = resolve(sourceArg);
const destination = resolve(destinationArg);
await mkdir(dirname(destination), { recursive: true });

await sharp(source)
  .resize(768, 960, {
    fit: "cover",
    position: "attention",
  })
  .webp({ quality: 84, smartSubsample: true })
  .toFile(destination);

const metadata = await sharp(destination).metadata();
if (metadata.width !== 768 || metadata.height !== 960) {
  throw new Error(`Unexpected output dimensions: ${metadata.width}x${metadata.height}`);
}

console.log(destination);
