# 开发流程

## 分支

- `alpha`：预发布开发
- `release`：稳定版本发布准备
- `main`：默认分支

## 本地准备

```bash
bun install
```

常用命令：

```bash
bun run build
bun run typecheck
bun run test:ci
bun run verify:ci
```

## 日常流程

普通提交不会触发发布 CI。

```bash
git checkout alpha
git pull
# 修改文件
git add .
git commit -m "..."
git push origin alpha
```

## 发布触发方式

只有推送以下前缀的 tag 才会启动发布 workflow：

- `publish-alpha/`
- `publish-release/`

没有匹配的 tag，就不会启动发布流程。

## Alpha 发布

从当前 `alpha` 提交发布：

```bash
git checkout alpha
git pull
git tag publish-alpha/2026-04-15-1
git push origin publish-alpha/2026-04-15-1
```

workflow 会校验发布包、自动递增下一个 `alpha.N`，并用 npm 的 `alpha` dist-tag 发布。

版本会像这样递增：

- `0.1.0-alpha.0`
- `0.1.0-alpha.1`
- `0.1.0-alpha.2`

## Stable 发布

Stable tag 必须打在一个已经准备好正式版本号的提交上。

典型流程：

```bash
git checkout release
git pull
bun run changeset
bun run version:package
git add .
git commit -m "Prepare stable release"
git push origin release
git tag publish-release/0.1.0
git push origin publish-release/0.1.0
```

如果 `packages/vop/package.json` 仍然是 `0.1.0-alpha.3` 这种预发布版本，stable workflow 会失败。

## Tag 命名

只要求前缀正确。

示例：

- `publish-alpha/2026-04-15-1`
- `publish-alpha/v0.1.0-build-1`
- `publish-release/0.1.0`
- `publish-release/2026-04-15`

## 删除错误 Tag

删除本地 tag：

```bash
git tag -d publish-alpha/2026-04-15-1
```

删除远端 tag：

```bash
git push origin :refs/tags/publish-alpha/2026-04-15-1
```
