---
changelogVersion: 1
plugin: "donaldxdonald_cloudflare-ai"
version: "0.7.1"
locale: "zh-CN"
---
# Changelog

## [0.7.1]

### Fixed

- `POST /v1/chat/completions` 接受渠道中配置的任意模型名称，包括插件建议列表之外的模型，以及映射到上游聊天模型的别名。为每个新增模型配置普通中转 token 定价。
