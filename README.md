# Donald Mok's New API Plugins

Donald Mok 维护的 New API 任务插件市场，目前收录 Cloudflare AI 扩展。这不是 New API 官方市场。

目录和索引工具沿用 [QuantumNous/new-api-plugins](https://github.com/QuantumNous/new-api-plugins)。通过 HTTPS 提供仓库文件即可使用，无需后端。

## 插件

| 插件 | 当前版本 | 支持范围 | 配置 |
| --- | --- | --- | --- |
| Cloudflare AI | `0.6.0` | FLUX 图片、MiniMax H3 视频、Clef 结构化判断 | [使用说明](docs/cloudflare-ai.md) |

Cloudflare AI `0.6.0` 增加 Gateway ID 渠道配置和密钥格式检查。已发布的 `0.5.1` 保持不变。

## 添加市场源

将此目录发布到公开的 GitHub 仓库，默认分支使用 `main`。

在 New API 管理后台进入任务插件的插件市场，新增市场源。名称填写 `Donald Mok's New API Plugins`，索引地址使用以下格式，替换其中的仓库信息：

```text
https://raw.githubusercontent.com/YOUR_GITHUB_OWNER/YOUR_REPOSITORY/main/index.json
```

选择该源，安装并激活 Cloudflare AI。也可以在上传弹窗中直接使用插件地址：

```text
https://raw.githubusercontent.com/YOUR_GITHUB_OWNER/YOUR_REPOSITORY/main/plugins/tasks/cloudflare-ai/0.6.0/plugin.js
```

其他 HTTPS 静态托管也可以使用。保留仓库目录结构，并允许 CORS，因为管理员的浏览器会直接读取索引和源码。不要只上传 `index.json`。

安装时，New API 会核对源码 SHA-256、编译插件并检查路由冲突。Cloudflare AI `0.6.0` 需要 `v1.0.0-rc.51` 或更新版本，使用渠道配置和密钥校验钩子。索引里的 `minApiVersion: 1` 指插件 API 版本，不是 New API 发布版本。

## 目录

```text
plugins/tasks/cloudflare-ai/0.6.0/
  plugin.js
  README.md
  README.zh-CN.md
  CHANGELOG.md
  CHANGELOG.zh-CN.md
docs/
  cloudflare-ai.md
  marketplace.md
tools/pluginindex/
  main.go
  go.mod
  go.sum
.github/workflows/validate.yml
index.json
```

## 生成和校验索引

需要 Git、Go 和同级的 New API 源码目录。工具编译插件后生成索引，不要手改 `index.json`。

```text
workspace/
  new-api/
  new-api-plugins/
```

CI 固定使用 rc.51 的 commit `c9c6da2786b6a0912215127e78e28fbc6650c85f`。在本仓库根目录执行：

```bash
git clone https://github.com/QuantumNous/new-api.git ../new-api
git -C ../new-api checkout c9c6da2786b6a0912215127e78e28fbc6650c85f
cd tools/pluginindex
go run . generate ../..
go run . check ../..
```

为索引工具单独克隆 `../new-api`，不要切换正在开发的工作目录。Go 版本以 New API 的 `go.mod` 为准。

`check` 会编译所有插件，核对 key、version 和目录名，并检查索引是否过期。GitHub Actions 还会拒绝修改或删除已发布版本文件的 PR。要限制直接 push，需配置 GitHub 分支保护。

插件行为和计费测试放在 New API 仓库或仓库外的临时目录，不放进市场仓库。索引工具不检查更新记录，发布前还需按 [更新记录规范](docs/marketplace.md#release-notes) 单独核对。

## 维护

- 修复或新增功能时，创建 `plugins/tasks/<key>/<version>/plugin.js`，修改 `meta.version`，并添加英文 `README.md` 和 `CHANGELOG.md`。
- 中文更新记录放在 `CHANGELOG.zh-CN.md`，由英文文件的 `translations` 字段声明。中文使用说明为 `README.zh-CN.md`，由英文 `README.md` 的 `translations` 声明。
- 提交新版本及更新记录时，一并提交重新生成的 `index.json`。
- 不提交 token、账号凭据、真实渠道配置或推理日志。
- 上游来源和本地修改见 [NOTICE](NOTICE)，许可证见 [LICENSE](LICENSE)。

插件能读取渠道凭据并发送上游请求。哈希匹配只能确认文件一致，不能证明源码安全。
