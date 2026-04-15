# SDK Boundary

Use these imports in application code:

- `@futelab/vop/sdk`
- `@futelab/vop/protocol`
- `@futelab/vop/runtime`
- `@futelab/vop/panel/react`

Do not import directly from repository-internal source paths.

The SDK includes:

- protocol types
- runtime surface
- host capability contracts
- binding helpers
- manifest-to-execution helpers
- assistant planning types re-exported for consumers

The SDK does not include:

- product-specific business logic
- app-only debug panels
- direct access to internal workspace source files
