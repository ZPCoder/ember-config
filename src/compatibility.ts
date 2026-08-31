import type { ConfigManifest } from "./types.js";

interface ParsedSemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
}

export interface ClientCompatibility {
  readonly compatible: boolean;
  readonly clientVersion: string;
  readonly minimumClientVersion: string;
  readonly reason?: "invalid-client-version" | "invalid-minimum-version" | "client-update-required";
}

export class MinimumClientVersionError extends Error {
  readonly result: ClientCompatibility;

  constructor(result: ClientCompatibility) {
    super(`Client ${result.clientVersion} does not satisfy minimum ${result.minimumClientVersion}: ${result.reason}`);
    this.name = "MinimumClientVersionError";
    this.result = result;
  }
}

function parseSemVer(value: string): ParsedSemVer | null {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function compareIdentifier(left: string, right: string): number {
  const leftNumeric = /^[0-9]+$/.test(left);
  const rightNumeric = /^[0-9]+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left.localeCompare(right);
}

function compare(left: ParsedSemVer, right: ParsedSemVer): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    const result = compareIdentifier(leftPart, rightPart);
    if (result !== 0) return result;
  }
  return 0;
}

export function checkMinimumClientVersion(
  clientVersion: string,
  manifestOrMinimum: ConfigManifest | string,
): ClientCompatibility {
  const minimumClientVersion = typeof manifestOrMinimum === "string"
    ? manifestOrMinimum
    : manifestOrMinimum.minimumClientVersion;
  const client = parseSemVer(clientVersion);
  const minimum = parseSemVer(minimumClientVersion);
  if (!client) return { compatible: false, clientVersion, minimumClientVersion, reason: "invalid-client-version" };
  if (!minimum) return { compatible: false, clientVersion, minimumClientVersion, reason: "invalid-minimum-version" };
  if (compare(client, minimum) < 0) return { compatible: false, clientVersion, minimumClientVersion, reason: "client-update-required" };
  return { compatible: true, clientVersion, minimumClientVersion };
}

export function assertClientCompatible(
  clientVersion: string,
  manifestOrMinimum: ConfigManifest | string,
): void {
  const result = checkMinimumClientVersion(clientVersion, manifestOrMinimum);
  if (!result.compatible) throw new MinimumClientVersionError(result);
}
