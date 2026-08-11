import { mkdir, writeFile } from "node:fs/promises";

import { CARD_CATALOG } from "../lib/game/catalog.ts";

const output = "flutter_app/assets/cards.json";
await mkdir("flutter_app/assets", { recursive: true });
await writeFile(output, `${JSON.stringify(CARD_CATALOG, null, 2)}\n`, "utf8");
console.log(`Exported ${CARD_CATALOG.length} cards to ${output}`);
