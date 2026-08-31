import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArguments = process.argv.slice(2);
if (sourceArguments.length === 0) {
  console.error("Usage: node scripts/verify-source-art.mjs <card-art-directory> [mirror-directory ...]");
  process.exit(2);
}

const cards = JSON.parse(await readFile(path.join(root, "data/cards/1.0.0/cards.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "manifests/resources-1.0.0.json"), "utf8"));
const expected = manifest.resources.find((resource) => resource.id === "card-art/full-webp");
if (!expected) throw new Error("card-art/full-webp is absent from the resource manifest");

const expectedNames = cards.map((card) => `${card.id}.webp`).sort();
for (const sourceArgument of sourceArguments) {
  const source = path.resolve(root, sourceArgument);
  const actualNames = (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) {
    const expectedSet = new Set(expectedNames);
    const actualSet = new Set(actualNames);
    const missing = expectedNames.filter((name) => !actualSet.has(name));
    const unexpected = actualNames.filter((name) => !expectedSet.has(name));
    throw new Error(`card-art inventory mismatch at ${source}; missing=${missing.slice(0, 5)} unexpected=${unexpected.slice(0, 5)}`);
  }

  let totalBytes = 0;
  let records = "";
  for (const name of actualNames) {
    const filePath = path.join(source, name);
    const metadata = await stat(filePath);
    const bytes = await readFile(filePath);
    const fileSha = createHash("sha256").update(bytes).digest("hex");
    totalBytes += metadata.size;
    records += `${name}\0${metadata.size}\0${fileSha}\n`;
  }
  const aggregateSha = createHash("sha256").update(records).digest("hex");

  if (actualNames.length !== expected.fileCount || totalBytes !== expected.size || aggregateSha !== expected.sha256) {
    throw new Error(`card-art digest mismatch at ${source}; files=${actualNames.length}, bytes=${totalBytes}, sha256=${aggregateSha}`);
  }

  console.log(`Verified ${actualNames.length} card-art files at ${source} (${totalBytes} bytes), aggregate SHA-256 ${aggregateSha}.`);
}
