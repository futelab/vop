# Authoring

VOP configuration is centered around two parts:

- define `planner`
- define `pages`
- generate runtime
- wire runtime into the host app

## Minimal Example

```ts
import { defineVopConfig } from '@futelab/vop/sdk';

export default defineVopConfig({
  planner: {
    baseURL: '/api/vop-planner',
    model: 'Qwen/Qwen3.5-397B-A17B-FP8',
    title: 'VOP Copilot',
  },
  pages: [
    {
      route: '/dashboard/analytics',
      title: 'Dashboard Analytics',
      group: 'Dashboard',
    },
  ],
});
```

`defineVopConfig(...)` has two top-level fields:

- `planner`
- `pages`

The rest of the manifest is derived internally.

## Planner Settings

`planner` configures the OpenAI-compatible planner request:

- `baseURL`
- `apiKey` (optional)
- `model`
- assistant UI copy such as `title`, `subtitle`, `welcomeMessage`, `defaultPrompt`
- optional `suggestedPrompts`
- optional `conversations`

Notes:

- `baseURL` should be same-origin relative or absolute
- VOP requests `${baseURL}/chat/completions`
- planner responses must be valid JSON or task creation will fail

## Page Types

VOP supports three page shapes:

- `shell`
- `form`
- `table`

Shell pages cover route-aware registration and navigation.
Form pages cover fill-and-submit flows.
Table pages cover search, selection, and bulk actions.
