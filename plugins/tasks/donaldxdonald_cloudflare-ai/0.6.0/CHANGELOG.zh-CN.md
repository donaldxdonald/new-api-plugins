---
changelogVersion: 1
plugin: "donaldxdonald_cloudflare-ai"
version: "0.6.0"
locale: "zh-CN"
---
# Changelog

## [0.6.0]

### Added

- 在渠道的插件设置中填写 H3 Gateway ID。留空使用账号默认 Gateway；已有的 `cf-aig-gateway-id` 请求头覆盖优先于表单值。
- 显示 Cloudflare token 格式提示；保存新渠道密钥时，含空白字符、Bearer 前缀或 JSON 的值会触发校验错误。
- 在市场安装弹窗中阅读英文或中文配置说明。

### Changed

- 插件 key 改为 `donaldxdonald_cloudflare-ai`。社区或第三方市场源会拒绝 key 中不带作者前缀的插件。

### Migration

- 安装此版本后，将所有 Task Plugin 渠道重新绑定到 `donaldxdonald_cloudflare-ai`。此前的 `cloudflare-ai` 是另一个插件，可以删除。
- 安装此版本前，将 New API 升级到 v1.0.0-rc.51 或更新版本，以使用渠道配置和密钥校验钩子。
