import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  MinimumClientVersionError,
  assertClientCompatible,
  checkMinimumClientVersion,
} from "../dist/index.js";

const cardsBytes = await readFile(new URL("../data/cards/1.0.0/cards.json", import.meta.url));
const cards = JSON.parse(cardsBytes.toString("utf8"));
const configManifest = JSON.parse(await readFile(new URL("../manifests/config-1.0.0.json", import.meta.url), "utf8"));
const resources = JSON.parse(await readFile(new URL("../manifests/resources-1.0.0.json", import.meta.url), "utf8"));

test("ships exactly 1000 unique catalog entries without images", () => {
  assert.equal(cards.length, 1000);
  assert.equal(new Set(cards.map((card) => card.id)).size, 1000);
  assert.equal(cards.every((card) => typeof card.id === "string" && typeof card.name === "string"), true);
});

test("pins exact catalog bytes with SHA-256 and size", () => {
  assert.equal(configManifest.size, cardsBytes.length);
  assert.equal(configManifest.sha256, createHash("sha256").update(cardsBytes).digest("hex"));
  assert.match(configManifest.bundleUrl, /^https:\/\//);
  assert.ok(configManifest.bundleUrl.includes(`/${configManifest.version}/`));
});

test("requires every resource to carry license and source proof", async () => {
  assert.equal(resources.resources.length, 2);
  for (const resource of resources.resources) {
    assert.match(resource.sha256, /^[a-f0-9]{64}$/);
    assert.ok(resource.licenseId);
    assert.ok(resource.licenseProof);
    assert.ok(resource.sourceProof);
    await access(new URL(`../${resource.licenseProof}`, import.meta.url));
    await access(new URL(`../${resource.sourceProof}`, import.meta.url));
  }
  const art = resources.resources.find((resource) => resource.id === "card-art/full-webp");
  assert.equal(art.fileCount, 1000);
  assert.equal(art.size, 36915650);
});

test("enforces minimum client SemVer including prereleases", () => {
  assert.equal(checkMinimumClientVersion("0.1.0", configManifest).compatible, true);
  assert.equal(checkMinimumClientVersion("0.2.0", configManifest).compatible, true);
  assert.equal(checkMinimumClientVersion("0.0.9", configManifest).reason, "client-update-required");
  assert.equal(checkMinimumClientVersion("0.1.0-beta.1", configManifest).compatible, false);
  assert.equal(checkMinimumClientVersion("not-semver", configManifest).reason, "invalid-client-version");
  assert.throws(() => assertClientCompatible("0.0.9", configManifest), MinimumClientVersionError);
});

test("build emits versioned immutable artifacts", async () => {
  await access(new URL("../dist/bundles/cards-1.0.0.json", import.meta.url));
  const index = JSON.parse(await readFile(new URL("../dist/bundles/card-index-1.0.0.json", import.meta.url), "utf8"));
  assert.equal(index.length, 1000);
  assert.equal(index[0].art, `${index[0].id}.webp`);
});
