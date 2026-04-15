# vop

Visible Operations Protocol for route-aware AI execution in real web apps.

[中文 README](./README.zh-CN.md) · [Docs](./docs/README.md) · [中文文档](./docs/README.zh-CN.md) · [Example](https://github.com/futelab/vop-examples) 

![example-antd](./docs/assets/images/example-antd.gif)

## What VOP includes

- config normalization
- planner helpers
- runtime execution
- confirmation flow for high-risk actions
- React assistant UI exports
- runtime file generation CLI

Supported page shapes:

- `shell`
- `form`
- `table`

## Install

```bash
npm install @futelab/vop
```

## Imports

```ts
import { defineVopConfig } from "@futelab/vop/sdk";
import type { VOPAppManifest } from "@futelab/vop/protocol";
import { VOPRuntime } from "@futelab/vop/runtime";
import { VopAssistant } from "@futelab/vop/panel/react";
```

- `defineVopConfig` is used to describe your planner and pages in `vop.config.ts`
- `VOPRuntime` is the runtime controller used by the host app
- `VopAssistant` is the ready-to-use React assistant UI
- `VOPAppManifest` and related protocol types are available when you need type-safe host integration

## Example `vop.config.ts`

```ts
import { defineVopConfig } from "@futelab/vop/sdk";

export default defineVopConfig({
  planner: {
    baseURL: "/api/vop-planner",
    model: "Qwen/Qwen3.5-397B-A17B-FP8",
    title: "VOP Copilot",
  },
  pages: [
    {
      route: "/dashboard/analytics",
      title: "Dashboard Analytics",
      group: "Dashboard",
    },
    {
      route: "/demos/form",
      title: "Form Demo",
      kind: "form",
      rootSelector: "#app",
      formSelector: "form",
      submitButtonSelector: 'button[type="submit"]',
      fields: {
        title: {
          kind: "text",
          selector: 'input[name="title"]',
          label: "Title",
          required: true,
        },
      },
    },
  ],
});
```

The CLI reads this file and turns it into the runtime data your app uses.

## Generate a runtime file

```bash
bunx @futelab/vop generate --config ./vop.config.ts
```

This command generates a file that wires your config into the runtime, typically something like `src/vop.generated.ts`.

## Use it in the host app

This is the pattern used in the `ant-design-pro` example:

```ts
import React from "react";
import {
  createConfiguredAssistantBindings,
  VopAssistant,
  VopHighlight,
} from "@futelab/vop/sdk";
import vopConfig from "../vop.config";
import { getCurrentVopPageId, getVopRuntime } from "./vop.generated";

const vopBindings = createConfiguredAssistantBindings(
  vopConfig,
  getVopRuntime(),
  getCurrentVopPageId,
);

export function AppShell() {
  return (
    <>
      <YourAppRoutes />
      <VopAssistant {...vopBindings} />
      <VopHighlight runtime={getVopRuntime()} />
    </>
  );
}
```

In this setup:

- `getVopRuntime()` returns the shared `VOPRuntime` instance
- `createConfiguredAssistantBindings(...)` connects your config, runtime, and current page lookup
- `VopAssistant` renders the assistant UI
- `VopHighlight` renders the runtime highlight layer

## `VOPRuntime` and `VOPAppManifest`

Most apps do not need to construct these objects by hand if they use `vop.config.ts` and the generated runtime file, but both are available when you need tighter host-side integration.

```ts
import { VOPRuntime } from "@futelab/vop/runtime";
import type { VOPAppManifest } from "@futelab/vop/protocol";

const runtime = new VOPRuntime();

const manifest: VOPAppManifest = {
  appId: "demo-app",
  version: "1.0.0",
  pages: [{ pageId: "dashboard", title: "Dashboard", route: "/dashboard" }],
  navigation: [],
};

runtime.registerAppManifest(manifest);
```

## Repository contents

- `packages/vop` — published package
- `docs` — project documentation

Example apps are maintained outside this repository.

## Documentation

- `docs/getting-started.md`
- `docs/authoring.md`
- `docs/runtime.md`
- `docs/sdk-boundary.md`
- `docs/packaging.md`
