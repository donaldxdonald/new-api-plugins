---
changelogVersion: 1
plugin: "donaldxdonald_cloudflare-ai"
version: "0.5.1"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [0.5.1]

### Added

- Generate one Base64 image with `@cf/black-forest-labs/flux-1-schnell` through `POST /v1/images/generations`.
- Generate H3 videos through `POST /v1/videos` with HTTPS image, video, or audio references. Read saved results through the New API video endpoints.
- Call Clef, Clef Flash, and Clef Omni through `POST /v1/systemone` or `POST /v1/decisions`. System One accepts embedded images, plus audio and video for Clef Omni.
- Use two channels with the same plugin: one for Workers AI hosted models, and one for MiniMax H3 through AI Gateway.

### Changed

- FLUX ignores unsupported image options, including `output_format`, `size`, and `seed`. They do not change the output format or dimensions.

### Fixed

- Image usage extraction accepts the original OpenAI request body as well as decoded task input. It no longer fails when the host preserves the original JSON.

### Migration

- Set task usage expression prices before enabling models. FLUX uses `image_count` and optionally `steps`; H3 uses `seconds` and `resolution`; Clef uses `input_tokens`. Legacy per-call and multiplier billing are rejected.
- Use New API with `json-order@1`, usage profiles, and model-scoped native routes. This release was verified on v1.0.0-rc.47.
- Disable any other plugin using `POST /v1/systemone` before enabling Cloudflare AI. On rc.47, Cloudflare AI and TypeSafe cannot share that route.
