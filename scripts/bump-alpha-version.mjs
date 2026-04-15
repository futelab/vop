import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const defaultPackageFiles = [
  "packages/vop/package.json",
  "packages/protocol/package.json",
  "packages/runtime/package.json",
  "packages/panel/package.json",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getPackageFiles() {
  if (!process.env.VOP_ALPHA_PACKAGE_FILES) {
    return defaultPackageFiles.map((filePath) => path.resolve(process.cwd(), filePath));
  }

  const parsed = JSON.parse(process.env.VOP_ALPHA_PACKAGE_FILES);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("VOP_ALPHA_PACKAGE_FILES must be a non-empty JSON array.");
  }

  return parsed.map((filePath) => path.resolve(process.cwd(), filePath));
}

function parseAlphaVersion(version) {
  const match = /^(.*)-alpha\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Expected an alpha prerelease version, received ${version}.`);
  }

  return {
    baseVersion: match[1],
    alphaNumber: Number(match[2]),
  };
}

function normalizePublishedVersions(raw) {
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === "string") {
    return [parsed];
  }

  throw new Error("Unexpected npm view output while resolving published versions.");
}

function getPublishedVersions(packageName) {
  if (process.env.VOP_ALPHA_PUBLISHED_VERSIONS_JSON) {
    return normalizePublishedVersions(process.env.VOP_ALPHA_PUBLISHED_VERSIONS_JSON);
  }

  try {
    const result = execFileSync("npm", ["view", packageName, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return normalizePublishedVersions(result);
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? "";
    const stdout = error.stdout?.toString?.() ?? "";
    const output = `${stdout}\n${stderr}`;

    if (error.status === 1 && /E404|404/.test(output)) {
      return [];
    }

    throw new Error(
      `Failed to resolve published versions for ${packageName}: ${output.trim() || error.message}`,
    );
  }
}

function computeNextVersion(currentVersion, publishedVersions) {
  const { baseVersion, alphaNumber: currentAlphaNumber } = parseAlphaVersion(currentVersion);
  const publishedAlphaNumbers = publishedVersions
    .filter((version) => version.startsWith(`${baseVersion}-alpha.`))
    .map((version) => Number(version.match(/-alpha\.(\d+)$/)?.[1] ?? Number.NaN))
    .filter((value) => Number.isInteger(value) && value >= 0);

  const nextAlphaNumber =
    publishedAlphaNumbers.length === 0
      ? currentAlphaNumber
      : Math.max(currentAlphaNumber, Math.max(...publishedAlphaNumbers) + 1);

  return `${baseVersion}-alpha.${nextAlphaNumber}`;
}

function main() {
  const packageFiles = getPackageFiles();
  const publicPackage = readJson(packageFiles[0]);
  const nextVersion = computeNextVersion(
    publicPackage.version,
    getPublishedVersions(publicPackage.name),
  );

  for (const packageFile of packageFiles) {
    const packageJson = readJson(packageFile);
    packageJson.version = nextVersion;
    writeJson(packageFile, packageJson);
  }

  console.log(`alpha version bumped to ${nextVersion}`);
}

main();
