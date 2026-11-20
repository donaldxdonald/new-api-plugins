---
changelogVersion: 1
plugin: "donaldxdonald_cloudflare-ai"
version: "0.7.1"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [0.7.1]

### Fixed

- Accept any channel-configured model name on `POST /v1/chat/completions`, including models outside the plugin's suggested list and aliases mapped to upstream chat models. Configure ordinary relay token pricing for each added model.
