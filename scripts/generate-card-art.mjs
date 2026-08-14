import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CARD_CATALOG, EXPANDED_FACTION_THEMES } from "../lib/game/index.ts";

const root = process.cwd();
const outputDir = path.join(root, "public/cards");
const sourceDir = path.join(root, "public/card-art-sources");
const anchor = path.join(sourceDir, "frost-anchor.png");
const ART_WIDTH = 384;
const ART_HEIGHT = 480;
const imageGenManifestPath = path.join(root, "public/card-art-imagegen.json");
let imageGenManifest = { workflow: "built-in-imagegen-one-card-per-call", generatedCount: 0, cards: [] };
try {
  imageGenManifest = JSON.parse(await fs.readFile(imageGenManifestPath, "utf8"));
} catch {
  // The manifest is optional while new individually generated art is being added.
}
const imageGenIds = new Set(imageGenManifest.cards.map((entry) => entry.id));
const existingFiles = await fs.readdir(outputDir);
const existingByPrefix = new Map();
for (const file of existingFiles.filter((name) => name.endsWith(".webp"))) {
  const prefix = file.split("-")[0];
  const list = existingByPrefix.get(prefix) ?? [];
  list.push(path.join(outputDir, file));
  existingByPrefix.set(prefix, list);
}

const palettes = {
  sun: ["#f5d37a", "#fb8f5f"], void: ["#4b78b5", "#6e5cb8"], neutral: ["#b4a17d", "#5f8f8a"],
  ember: ["#ef6337", "#f0ad4e"], astral: ["#9b7cdf", "#4f9fd3"], verdant: ["#78bf83", "#d4c565"], storm: ["#54cbd2", "#6477e9"],
  frost: ["#79dcff", "#9d8cff"], sand: ["#e2b45d", "#e67b46"], bloodmoon: ["#e24d62", "#6a284d"], leyline: ["#67e8d4", "#8f7dff"],
  dusk: ["#7359a8", "#3a4777"], cloudfall: ["#8bd7ec", "#567ed5"], magnet: ["#e08e55", "#4a93a7"], crystal: ["#dcecff", "#8e8cff"],
  dream: ["#f0a9e6", "#5e81dc"], rift: ["#f36b52", "#9b4ce1"], timesand: ["#e5c779", "#a17c56"], gloomwood: ["#7bbf76", "#4c335e"], firmament: ["#ffe3a2", "#6ba9de"],
};

function themeFor(faction) {
  return EXPANDED_FACTION_THEMES.find((theme) => theme.faction === faction) ?? EXPANDED_FACTION_THEMES[0];
}

function accentSvg(width, height, primary, secondary, index, type) {
  const rotation = (index * 37) % 360;
  const kind = type === "spell" ? `<circle cx="${width * 0.5}" cy="${height * 0.46}" r="${130 + (index % 5) * 14}" fill="none" stroke="${primary}" stroke-opacity=".64" stroke-width="12"/><circle cx="${width * 0.5}" cy="${height * 0.46}" r="${68 + (index % 4) * 13}" fill="${secondary}" fill-opacity=".2"/>` : type === "weapon" ? `<path d="M${width * 0.18} ${height * 0.8} L${width * 0.78} ${height * 0.18} L${width * 0.7} ${height * 0.5} L${width * 0.9} ${height * 0.7} L${width * 0.42} ${height * 0.63} Z" fill="${primary}" fill-opacity=".36" stroke="${secondary}" stroke-width="10"/>` : `<path d="M${width * 0.14} ${height * 0.72} Q${width * 0.5} ${height * (0.18 + (index % 3) * 0.06)} ${width * 0.86} ${height * 0.72}" fill="none" stroke="${primary}" stroke-opacity=".5" stroke-width="15"/><path d="M${width * 0.27} ${height * 0.78} L${width * 0.5} ${height * 0.24} L${width * 0.73} ${height * 0.78}" fill="${secondary}" fill-opacity=".18"/>`;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${rotation} ${width / 2} ${height / 2})">${kind}</g><rect width="${width}" height="${height}" fill="url(#fade)"/><defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}" stop-opacity=".12"/><stop offset="1" stop-color="${secondary}" stop-opacity=".08"/></linearGradient></defs></svg>`);
}

const regenerateAll = process.env.FORCE_ALL_CARD_ART === "1";
const cardsToGenerate = CARD_CATALOG.filter((card) =>
  (regenerateAll || card.id.includes("-season-")) &&
  (!imageGenIds.has(card.id) || process.env.FORCE_IMAGEGEN_OVERWRITE === "1") &&
  (!existingFiles.includes(`${card.id}.webp`) || process.env.FORCE_CARD_ART === "1" || regenerateAll),
);
for (let position = 0; position < cardsToGenerate.length; position += 1) {
  const card = cardsToGenerate[position];
  const theme = themeFor(card.faction);
  const [primary, secondary] = palettes[theme.slug] ?? palettes.frost;
  const targetPath = path.join(outputDir, `${card.id}.webp`);
  const candidates = (existingByPrefix.get(theme.slug) ?? []).filter((file) => file !== targetPath);
  const source = candidates[position % Math.max(candidates.length, 1)] ?? anchor;
  const hue = (theme.offset * 29 + position * 17) % 360;
  const base = await sharp(source)
    .resize(ART_WIDTH, ART_HEIGHT, { fit: "cover", position: position % 2 === 0 ? "centre" : "entropy" })
    .modulate({ hue, saturation: 1.03 + (position % 5) * 0.04, brightness: 0.94 + (position % 7) * 0.018 })
    .composite([{ input: accentSvg(ART_WIDTH, ART_HEIGHT, primary, secondary, position, card.type), blend: "screen" }])
    // 384×480 keeps the 4:5 card ratio crisp on phones while keeping the
    // deployable site light enough for source-repository and mobile delivery.
    .webp({ quality: 72, effort: 6, smartSubsample: true });
  await base.toFile(targetPath);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  catalogCount: CARD_CATALOG.length,
  generatedCount: cardsToGenerate.length,
  individuallyGeneratedCount: imageGenIds.size,
  generatedBy: "imagegen-per-card-plus-legacy-variants",
  anchor: "public/card-art-sources/frost-anchor.png",
  cards: CARD_CATALOG.map((card) => ({
    id: card.id,
    faction: card.faction,
    type: card.type,
    art: `/cards/${card.id}.webp`,
    source: imageGenIds.has(card.id) ? "imagegen" : "legacy-variant",
  })),
};
await fs.writeFile(path.join(root, "public/card-art-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${cardsToGenerate.length} card art assets; ${CARD_CATALOG.length} cards now have manifest entries.`);
