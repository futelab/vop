# 快速开始

## 环境要求

- Node.js 20+
- Bun 1.3+

## 安装依赖

```bash
bun install
```

## 常用命令

```bash
bun run build
bun run typecheck
bun run test
bun run pack:package
```

## 导入入口

安装发布包：

```bash
npm install @futelab/vop
```

常用导入入口：

- `@futelab/vop/sdk`
- `@futelab/vop/protocol`
- `@futelab/vop/runtime`
- `@futelab/vop/panel/react`

## 生成 Runtime 文件

```bash
bunx @futelab/vop generate --config ./vop.config.ts
```
