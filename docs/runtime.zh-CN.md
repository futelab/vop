# Runtime

runtime 负责：

- 注册 app 与 page manifest
- 分发 action
- 跟踪任务状态
- 处理确认流
- 维护高亮状态
- 向宿主 UI 暴露 snapshot

## 执行流程

1. Planner 返回任务定义
2. Runtime 启动任务
3. Action 按顺序执行
4. 高风险 action 进入 `awaiting_confirmation`
5. 宿主 UI 确认或取消
6. Runtime 将任务标记为完成、取消或失败

## 宿主 UI

runtime 不绑定某一个 UI 框架。当前仓库公开发布的 React assistant 入口是：

- `@futelab/vop/panel/react`

`@futelab/vop/sdk` 也会重新导出宿主应用需要的公开 assistant 类型。
