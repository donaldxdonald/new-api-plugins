---
changelogVersion: 1
plugin: "cloudflare-ai"
version: "0.6.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [0.6.0]

### Added

- Set the H3 Gateway ID in the channel's plugin settings. Leave it empty to use the account default; an existing `cf-aig-gateway-id` Request Header Override takes precedence.
- See a Cloudflare token format hint and receive a validation error when saving a new channel key with whitespace, a Bearer prefix, or JSON.
- Read English or Chinese setup instructions in the marketplace installation dialog.

### Migration

- Upgrade New API to v1.0.0-rc.51 or later before installing this version, which uses channel configuration and key validation hooks.
