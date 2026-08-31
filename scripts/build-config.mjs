import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = "1.0.0";
const catalogPath = path.join(root, "data", "cards", version, "cards.json");
const configManifestPath = path.join(root, "manifests", `config-${version}.json`);
const resourceManifestPath = path.join(root, "manifests", `resources-${version}.json`);

const catalogBytes = await readFile(catalogPath);
const catalog = JSON.parse(catalogBytes.toString("utf8"));
const configManifest = JSON.parse(await readFile(configManifestPath, "utf8"));
const resourceManifest = JSON.parse(await readFile(resourceManifestPath, "utf8"));
const errors = [];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const semVer = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const digest = /^[a-f0-9]{64}$/;

if (!Array.isArray(catalog)) errors.push("cards.json must be an array");
if (catalog.length !== 1000) errors.push(`cards.json must contain 1000 cards, found ${catalog.length}`);

const seenIds = new Set();
for (const [index, card] of catalog.entries()) {
  if (!card || typeof card !== "object") {
    errors.push(`card ${index} must be an object`);
    continue;
  }
  if (typeof card.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id)) errors.push(`card ${index} has invalid id`);
  if (seenIds.has(card.id)) errors.push(`duplicate card id ${card.id}`);
  seenIds.add(card.id);
  if (typeof card.name !== "string" || card.name.length === 0) errors.push(`${card.id}: name is required`);
  if (typeof card.description !== "string") errors.push(`${card.id}: description is required`);
  if (typeof card.faction !== "string" || card.faction.length === 0) errors.push(`${card.id}: faction is required`);
  if (!["unit", "spell", "weapon", "hero", "location"].includes(card.type)) errors.push(`${card.id}: invalid card type`);
  if (!Number.isInteger(card.cost) || card.cost < 0) errors.push(`${card.id}: cost must be a non-negative integer`);
  if (typeof card.set !== "string" || card.set.length === 0) errors.push(`${card.id}: set is required`);
}

if (configManifest.version !== version) errors.push("config manifest version does not match its immutable directory");
if (!semVer.test(configManifest.version)) errors.push("config manifest version is not SemVer");
if (!semVer.test(configManifest.minimumClientVersion)) errors.push("minimumClientVersion is not SemVer");
if (configManifest.sha256 !== sha256(catalogBytes)) errors.push("config manifest SHA-256 does not match exact catalog bytes");
if (configManifest.size !== catalogBytes.length) errors.push("config manifest byte size does not match exact catalog bytes");
if (!isImmutableHttpsUrl(configManifest.bundleUrl, version)) errors.push("config bundleUrl must be immutable HTTPS and include the version");

if (resourceManifest.schemaVersion !== 1 || resourceManifest.version !== version) errors.push("resource manifest schema or version is invalid");
if (!Array.isArray(resourceManifest.resources) || resourceManifest.resources.length === 0) errors.push("resource manifest must contain resources");
const resourceIds = new Set();
for (const resource of resourceManifest.resources ?? []) {
  if (resourceIds.has(resource.id)) errors.push(`duplicate resource id ${resource.id}`);
  resourceIds.add(resource.id);
  if (resource.version !== version) errors.push(`${resource.id}: version mismatch`);
  if (!digest.test(resource.sha256)) errors.push(`${resource.id}: invalid SHA-256`);
  if (!Number.isInteger(resource.size) || resource.size < 1) errors.push(`${resource.id}: invalid byte size`);
  if (!Number.isInteger(resource.fileCount) || resource.fileCount < 1) errors.push(`${resource.id}: invalid file count`);
  if (!isImmutableHttpsUrl(resource.url, version)) errors.push(`${resource.id}: URL must be immutable HTTPS and include version`);
  if (!resource.licenseId || !resource.licenseProof) errors.push(`${resource.id}: license metadata is required`);
  if (!resource.sourceProof) errors.push(`${resource.id}: source proof is required`);
  for (const proof of [resource.licenseProof, resource.sourceProof]) {
    try {
      await access(path.join(root, proof));
    } catch {
      errors.push(`${resource.id}: missing proof file ${proof}`);
    }
  }
}

const catalogResource = resourceManifest.resources?.find((resource) => resource.id === "card-catalog/json");
if (!catalogResource) errors.push("resource manifest is missing card-catalog/json");
else if (
  catalogResource.sha256 !== configManifest.sha256 ||
  catalogResource.size !== configManifest.size ||
  catalogResource.url !== configManifest.bundleUrl
) errors.push("config and resource manifests disagree about card-catalog/json");

if (errors.length > 0) {
  console.error(["Configuration validation failed:", ...errors.map((error) => `- ${error}`)].join("\n"));
  process.exitCode = 1;
} else if (process.argv.includes("--check")) {
  console.log(`Validated immutable config ${version}: ${catalog.length} cards, ${catalogBytes.length} bytes, ${configManifest.sha256}.`);
} else {
  const bundleDirectory = path.join(root, "dist", "bundles");
  const manifestDirectory = path.join(root, "dist", "manifests");
  await mkdir(bundleDirectory, { recursive: true });
  await mkdir(manifestDirectory, { recursive: true });
  await copyFile(catalogPath, path.join(bundleDirectory, `cards-${version}.json`));
  await copyFile(configManifestPath, path.join(manifestDirectory, `config-${version}.json`));
  await copyFile(resourceManifestPath, path.join(manifestDirectory, `resources-${version}.json`));
  await writeFile(
    path.join(bundleDirectory, `card-index-${version}.json`),
    `${JSON.stringify(catalog.map((card) => ({ id: card.id, art: `${card.id}.webp` })), null, 2)}\n`,
  );
  console.log(`Built immutable config ${version}: ${catalog.length} cards.`);
}

function isImmutableHttpsUrl(value, expectedVersion) {
  if (typeof value !== "string" || !value.startsWith("https://") || value.includes("?") || value.includes("#")) return false;
  try {
    const parsed = new URL(value.replace("{cardId}", "sample-card"));
    return parsed.protocol === "https:" && parsed.pathname.includes(`/${expectedVersion}/`);
  } catch {
    return false;
  }
}
