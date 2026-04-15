# Runtime

The runtime manages:

- registering app and page manifests
- dispatching actions
- tracking task state
- handling confirmation flows
- maintaining highlight state
- exposing snapshots for host UIs

## Execution Flow

1. Planner returns a task definition.
2. Runtime starts the task.
3. Actions execute sequentially.
4. High-risk actions pause in `awaiting_confirmation`.
5. Host UI confirms or cancels.
6. Runtime completes, cancels, or fails the task.

## Host UI

The runtime does not depend on a single UI framework. This repository currently publishes the React assistant surface at:

- `@futelab/vop/panel/react`

`@futelab/vop/sdk` also re-exports the public assistant types that host apps need.
