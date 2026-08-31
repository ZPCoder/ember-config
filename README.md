# ember-config

Versioned, non-secret gameplay configuration and resource provenance for Ember
Protocol. The first catalog contains exactly 1,000 cards from the frozen
monolith and does not duplicate card artwork.

## Immutable release flow

1. Add a new version directory under `data/cards/`; never edit a published one.
2. Add a new versioned config and resource manifest. URLs must be HTTPS,
   immutable and contain the version.
3. Run `npm test`. CI validates catalog shape, SHA-256, byte size, unique card
   IDs, client compatibility and asset provenance.
4. Upload the exact bytes from `dist/bundles/` to the object key declared by the
   manifest, then publish a GitHub Release/Package with a Changeset.

`minimumClientVersion` is enforced with `checkMinimumClientVersion`. Clients
below the threshold must stop before loading gameplay assets and show an update
message.

## Commands

```sh
npm install
npm test
npm run build
```

During migration, `npm run verify:source` additionally verifies all 1,000
source WebP files against the aggregate digest without copying them. That check
is intentionally separate because a standalone clone has no monolith checkout.

The `.example` URLs are reserved staging coordinates. `ember-ops` must provision
the production object-storage origin and publish a new manifest version before
4399 sandbox delivery; a published manifest is never edited in place.
