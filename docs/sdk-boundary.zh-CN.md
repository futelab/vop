# SDK 边界

应用代码直接使用这些导入入口：

- `@futelab/vop/sdk`
- `@futelab/vop/protocol`
- `@futelab/vop/runtime`
- `@futelab/vop/panel/react`

不要直接导入仓库内部源码路径。

SDK 包含：

- protocol 类型
- runtime surface
- 宿主能力契约
- binding helper
- manifest-to-execution helper
- 对外 assistant planning 类型

SDK 不包含：

- 产品特定业务逻辑
- 仅应用内部使用的调试面板
- 对内部 workspace 源码的直接访问
