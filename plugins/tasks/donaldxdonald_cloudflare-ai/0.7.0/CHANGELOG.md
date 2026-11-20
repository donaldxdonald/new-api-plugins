---
changelogVersion: 1
plugin: "donaldxdonald_cloudflare-ai"
version: "0.7.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [0.7.0]

### Added

- Chat with DeepSeek V4.1 Flash 1017 and GLM 4.7 Flash through `POST /v1/chat/completions`, with ordinary or streaming responses and relay token pricing.
- Forward a session-specific `x-session-affinity` header on the chat channel to improve prefix cache reuse on supported models. DeepSeek cache reads can be priced separately from uncached input.
