---
changelogVersion: 1
plugin: "donaldxdonald_cloudflare-ai"
version: "0.7.0"
locale: "zh-CN"
---
# Changelog

## [0.7.0]

### Added

- 可通过 `POST /v1/chat/completions` 调用 DeepSeek V4.1 Flash 1017 和 GLM 4.7 Flash，支持普通和流式响应，按普通中转 token 定价。
- 聊天渠道可透传每个会话独有的 `x-session-affinity` 请求头，提高受支持模型的前缀缓存命中率。DeepSeek 缓存命中输入可与未缓存输入分开定价。
