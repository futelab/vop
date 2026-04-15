import fs from "node:fs";
import path from "node:path";

const rootDir = new URL("..", import.meta.url);
const packageDir = new URL("../packages/vop/", import.meta.url);
const packageJson = JSON.parse(
  fs.readFileSync(new URL("./package.json", packageDir), "utf8"),
);
const skipDocsCheck =
  process.env.VOP_SKIP_DOC_CHECKS === "1" ||
  process.env.VOP_SKIP_DOC_CHECKS === "true";

const requiredExports = [
  "./sdk",
  "./protocol",
  "./runtime",
  "./panel/react",
];

for (const exportKey of requiredExports) {
  if (!packageJson.exports?.[exportKey]) {
    throw new Error(`Missing required export map entry: ${exportKey}`);
  }
}

const requiredFiles = [
  "dist/vop/src/sdk/index.js",
  "dist/vop/src/protocol.js",
  "dist/vop/src/runtime.js",
  "dist/vop/src/panel/react.js",
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(packageDir.pathname, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing built artifact: ${relativePath}`);
  }
}

const consumerReadme = fs.readFileSync(new URL("./README.md", packageDir), "utf8");
if (!consumerReadme.includes("npm install @futelab/vop")) {
  throw new Error("Public README no longer documents the single-package install path.");
}

if (consumerReadme.includes("@futelab/vop/panel/code")) {
  throw new Error("Public README still documents the retired panel/code subpath.");
}

if (!skipDocsCheck) {
  const requiredDocs = [
    "docs/README.md",
    "docs/README.zh-CN.md",
    "docs/getting-started.md",
    "docs/getting-started.zh-CN.md",
    "docs/authoring.md",
    "docs/authoring.zh-CN.md",
    "docs/runtime.md",
    "docs/runtime.zh-CN.md",
    "docs/sdk-boundary.md",
    "docs/sdk-boundary.zh-CN.md",
    "docs/packaging.md",
    "docs/packaging.zh-CN.md",
  ];

  for (const relativePath of requiredDocs) {
    const absolutePath = path.join(rootDir.pathname, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Missing required repository doc: ${relativePath}`);
    }
  }
}

const internalPackageOutputs = [
  ["packages/protocol/dist/index.js", "protocol package build output"],
  ["packages/runtime/dist/index.js", "runtime package build output"],
  ["packages/panel/dist/index.js", "panel package root build output"],
  ["packages/panel/dist/react.js", "panel package react build output"],
];

for (const [relativePath, label] of internalPackageOutputs) {
  const absolutePath = path.join(rootDir.pathname, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing ${label}: ${relativePath}`);
  }
}

const forbiddenNestedBuildOutputs = [
  "packages/runtime/dist/protocol",
  "packages/panel/dist/protocol",
  "packages/panel/dist/runtime",
];

for (const relativePath of forbiddenNestedBuildOutputs) {
  const absolutePath = path.join(rootDir.pathname, relativePath);
  if (fs.existsSync(absolutePath)) {
    throw new Error(`Unexpected nested build output remains: ${relativePath}`);
  }
}

const sourceFiles = fs
  .readdirSync(new URL("../packages/", import.meta.url), { recursive: true })
  .filter(
    (entry) =>
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      entry.includes("/src/") &&
      !entry.includes("/dist/"),
  );

const allowedCrossSourceImports = new Set([
  "vop/src/protocol.ts",
  "vop/src/runtime.ts",
  "vop/src/panel/react.ts",
]);

for (const relativeFile of sourceFiles) {
  const normalized = relativeFile.replace(/\\/g, "/");
  const fileContents = fs.readFileSync(
    new URL(`../packages/${normalized}`, import.meta.url),
    "utf8",
  );

  if (
    /\.\.\/(?:\.\.\/)?(?:protocol|runtime|panel)\/src\//.test(fileContents) &&
    !allowedCrossSourceImports.has(normalized)
  ) {
    throw new Error(`Forbidden cross-package src import in packages/${normalized}`);
  }
}

console.log("contract test ok");
