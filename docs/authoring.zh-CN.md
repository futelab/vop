# 配置说明

VOP 配置主要围绕两个部分展开：

- 定义 `planner`
- 定义 `pages`
- 生成 runtime
- 接入宿主应用

## 最小示例

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

`defineVopConfig(...)` 顶层只有两个字段：

- `planner`
- `pages`

其余 manifest 细节会在内部推导。

## Planner 配置

`planner` 用来配置 OpenAI-compatible 的任务规划请求：

- `baseURL`
- `apiKey`（可选）
- `model`
- assistant UI 文案，如 `title`、`subtitle`、`welcomeMessage`、`defaultPrompt`
- 可选 `suggestedPrompts`
- 可选 `conversations`

说明：

- `baseURL` 使用同源相对地址或绝对地址
- VOP 会请求 `${baseURL}/chat/completions`
- planner 返回必须是合法 JSON，否则任务创建会直接失败

## 页面类型

VOP 目前支持三种页面形态：

- `shell`
- `form`
- `table`

Shell 页面用于路由注册和导航。  
Form 页面用于字段建模、填表和提交。  
Table 页面用于搜索、选择和批量动作。
