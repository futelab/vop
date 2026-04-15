# Packaging

npm 包从这里发布：

- `packages/vop`
- npm 包：`@futelab/vop`

发布包包含：

- `dist/`
- `bin/`
- 包内 `README.md`
- 包内 `LICENSE`

以下内容不会进入发布包：

- 示例应用
- 仓库测试文件
- 作为支持导入面的内部 workspace 源码

## 发布命令

```bash
bun run changeset
bun run version:package
bun run pack:package
bun run release:alpha
```
