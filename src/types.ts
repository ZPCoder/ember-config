export interface ConfigManifest {
  readonly version: string;
  readonly minimumClientVersion: string;
  readonly sha256: string;
  readonly bundleUrl: string;
  readonly size: number;
}

export type ResourceKind = "config-bundle" | "remote-asset-set";

export interface ResourceDescriptor {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly version: string;
  readonly sha256: string;
  readonly url: string;
  readonly size: number;
  readonly fileCount: number;
  readonly mediaType: string;
  readonly licenseId: string;
  readonly licenseProof: string;
  readonly sourceProof: string;
}

export interface ResourceManifest {
  readonly schemaVersion: 1;
  readonly version: string;
  readonly resources: readonly ResourceDescriptor[];
}

export interface CardCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly faction: string;
  readonly type: "unit" | "spell" | "weapon" | "hero" | "location";
  readonly cost: number;
  readonly rarity: string;
  readonly set: string;
  readonly [key: string]: unknown;
}
