---
changelogVersion: 1
plugin: "cloudflare-ai"
version: "0.5.1"
locale: "zh-CN"
---
# Changelog

## [0.5.1]

### Added

- 通过 `POST /v1/images/generations` 调用 `@cf/black-forest-labs/flux-1-schnell`，返回单张 Base64 图片。
- 通过 `POST /v1/videos` 生成 H3 视频，可用 HTTPS 图片、视频或音频作为参考。使用 New API 视频接口读取已保存的结果。
- 通过 `POST /v1/systemone` 或 `POST /v1/decisions` 调用 Clef、Clef Flash 和 Clef Omni。System One 支持内嵌图片，Clef Omni 还支持内嵌音频和视频。
- 两个渠道共用插件：一个直连 Workers AI 托管模型，另一个通过 AI Gateway 调用 MiniMax H3。

### Changed

- FLUX 忽略 `output_format`、`size`、`seed` 等不支持的图片选项，它们不会改变输出格式或尺寸。

### Fixed

- 图片用量提取同时接受原始 OpenAI 请求体和解码后的任务输入，不再因宿主保留原始 JSON 而报错。

### Migration

- 开放模型前设置任务用量表达式价格。FLUX 使用 `image_count`，可选用 `steps`；H3 使用 `seconds` 和 `resolution`；Clef 使用 `input_tokens`。插件拒绝旧的按次和倍率计费。
- 使用支持 `json-order@1`、用量 profile 和按模型限定原生路由的 New API。本版本已在 v1.0.0-rc.47 验证。
- 启用 Cloudflare AI 前，停用其他使用 `POST /v1/systemone` 的插件。rc.47 不允许 Cloudflare AI 与 TypeSafe 共享该路由。
