import fs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
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

if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
  throw new Error("The public package should not depend on vite for config generation.");
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

const generateFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "vop-generate-"));
const generateConfigPath = path.join(generateFixtureDir, "vop.config.ts");
const generateOutputDir = path.join(generateFixtureDir, "generated");
const generateScriptPath = path.join(rootDir.pathname, "packages/vop/scripts/generate-vop.mjs");
const bumpScriptPath = path.join(rootDir.pathname, "scripts/bump-alpha-version.mjs");

fs.writeFileSync(
  generateConfigPath,
  `import { defineRoutePages, defineVopConfig, type VOPPublicConfig } from "@futelab/vop/sdk";

const planner: NonNullable<VOPPublicConfig["planner"]> = {
  baseURL: "/api/vop-planner",
  model: "Qwen/Qwen3.5-397B-A17B-FP8",
  title: "VOP Copilot",
};

const pages = defineRoutePages<
  VOPPublicConfig["pages"]
>([
  {
    route: "/dashboard/analytics",
    title: "Dashboard Analytics",
    group: "Dashboard",
  },
  {
    route: "/demos/form",
    title: "Form Demo",
    kind: "form",
    fields: {
      title: {
        kind: "text",
        selector: 'input[name="title"]',
        label: "Title",
        required: true,
      },
    },
  },
] satisfies VOPPublicConfig["pages"]);

export default defineVopConfig({
  planner,
  pages,
} satisfies VOPPublicConfig);
`,
  "utf8",
);

const generateResult = spawnSync(
  process.execPath,
  [generateScriptPath, "--config", generateConfigPath, "--out", generateOutputDir],
  {
    encoding: "utf8",
  },
);

if (generateResult.status !== 0) {
  throw new Error(
    [
      "generate-vop smoke test failed.",
      generateResult.stdout.trim(),
      generateResult.stderr.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

if (generateResult.stderr.includes("ExperimentalWarning")) {
  throw new Error("generate-vop should not print Node experimental warnings.");
}

const generatedRuntimePath = path.join(generateOutputDir, "vop.generated.ts");
if (!fs.existsSync(generatedRuntimePath)) {
  throw new Error("generate-vop smoke test did not produce vop.generated.ts.");
}

const generatedRuntime = fs.readFileSync(generatedRuntimePath, "utf8");
if (!generatedRuntime.includes('"/dashboard/analytics"')) {
  throw new Error("Generated runtime is missing the dashboard route.");
}

if (!generatedRuntime.includes('"/demos/form"')) {
  throw new Error("Generated runtime is missing the form route.");
}

const alphaFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "vop-alpha-bump-"));
const alphaPackageFiles = [
  path.join(alphaFixtureDir, "vop.package.json"),
  path.join(alphaFixtureDir, "protocol.package.json"),
  path.join(alphaFixtureDir, "runtime.package.json"),
  path.join(alphaFixtureDir, "panel.package.json"),
];

for (const [index, packageFile] of alphaPackageFiles.entries()) {
  fs.writeFileSync(
    packageFile,
    `${JSON.stringify(
      {
        name: index === 0 ? "@futelab/vop" : `@futelab/internal-${index}`,
        version: "0.1.0-alpha.0",
      },
      null,
      2,
    )}\n`,
  );
}

const bumpResult = spawnSync(process.execPath, [bumpScriptPath], {
  encoding: "utf8",
  env: {
    ...process.env,
    VOP_ALPHA_PACKAGE_FILES: JSON.stringify(alphaPackageFiles),
    VOP_ALPHA_PUBLISHED_VERSIONS_JSON: JSON.stringify([
      "0.1.0-alpha.0",
      "0.1.0-alpha.1",
    ]),
  },
});

if (bumpResult.status !== 0) {
  throw new Error(
    [
      "alpha bump smoke test failed.",
      bumpResult.stdout.trim(),
      bumpResult.stderr.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

for (const packageFile of alphaPackageFiles) {
  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  if (packageJson.version !== "0.1.0-alpha.2") {
    throw new Error(`Alpha bump smoke test failed for ${packageFile}.`);
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
