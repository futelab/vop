import fs from "node:fs";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../packages/vop/package.json", import.meta.url), "utf8"),
);

if (!/-alpha\./.test(packageJson.version)) {
  throw new Error(
    `Expected @futelab/vop version to be an alpha prerelease before alpha publish, received ${packageJson.version}.`,
  );
}

console.log(`alpha version ok: ${packageJson.version}`);
