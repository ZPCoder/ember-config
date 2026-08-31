# Migration provenance

This repository was extracted from the verified Ember Protocol monolith freeze.

- Source repository: `ZPCoder/Ember-Protocol`
- Source tag: `monolith-freeze-v1`
- Source commit: `ba8610c7664f0f8a7cfdd70f479e61c8c41a77d1`
- Catalog source: `flutter_app/assets/cards.json`
- Card-art sources: `public/cards/` and the byte-identical
  `flutter_app/assets/cards/` mirror

Only the 1,000-card JSON catalog is copied into this repository. Card artwork
is represented by a hashed resource manifest and remains in object storage;
large image files must never be committed here.
