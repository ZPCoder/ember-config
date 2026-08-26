import { cp, mkdir, writeFile } from "node:fs/promises";

import { CARD_CATALOG } from "../lib/game/catalog.ts";

const output = "flutter_app/assets/cards.json";
await mkdir("flutter_app/assets", { recursive: true });
await writeFile(output, `${JSON.stringify(CARD_CATALOG, null, 2)}\n`, "utf8");
await mkdir("flutter_app/assets/cards", { recursive: true });
await cp("public/cards", "flutter_app/assets/cards", { recursive: true });
console.log(`Exported ${CARD_CATALOG.length} cards and artwork to Flutter assets`);
