# Marketplace index v1

Adapted from the QuantumNous/new-api-plugins marketplace contract. Edited for this repository.

A marketplace serves `index.json` and the plugin files it lists over HTTP(S). New API can add any source that follows this format. Files must be reachable from the administrator's browser and allow cross-origin requests when hosted on another origin.

## Index format

This example omits optional display metadata:

```json
{
  "indexVersion": 1,
  "name": "Donald Mok's New API Plugins",
  "plugins": [
    {
      "key": "donaldxdonald_cloudflare-ai",
      "name": "Cloudflare AI",
      "latest": "0.5.1",
      "versions": [
        {
          "version": "0.5.1",
          "path": "plugins/tasks/donaldxdonald_cloudflare-ai/0.5.1/plugin.js",
          "sha256": "<SHA-256 of the plugin.js bytes>",
          "minApiVersion": 1,
          "kind": "task",
          "auth": "api_key"
        }
      ]
    }
  ]
}
```

- `path` resolves relative to the index URL. Keep the directory layout when changing hosts or mirrors. New API rejects plugin source URLs on a different origin.
- `sha256` hashes the source bytes. New API checks it before uploading the source.
- `kind` is `"task"`. The marketplace UI filters out unsupported kinds.
- `minApiVersion` describes the plugin API, not the minimum New API release. The host still checks the compiled manifest and required capabilities.
- `latest` names a version in the plugin's `versions` list. Display metadata describes that version.

Optional `iconFile` contains the `path` and `sha256` of a shared logo at `plugins/<kind>/<key>/icon.svg` or `icon.png`. New API fetches it from the index origin and stores it separately from the source. The plugin's `meta.icon` remains a LobeHub name or a text fallback.

The tool also copies these fields from compiled metadata:

| Fields | Use |
| --- | --- |
| `name`, `description`, `models`, `channelTypes`, `website`, `sortPriority` | Plugin display and selection |
| `routes`, `protocols` | Endpoints and protocol bindings |
| `task`, `provider`, `transform` | Parts of the latest version shown by marketplace filters; a plugin can have more than one |
| `usageSchema`, `usageExamples`, `usageProfiles` | Usage fields, model scopes, and billing examples |
| `allowedHosts`, `baseUrl`, `auth` | Version-specific installation hints |

Usage fields keep their localized `description`, `unitLabel`, and `enumLabels`. Profiles keep their model lists, schemas, and examples. Consumers should use this metadata when present; older indexes may require source parsing. Empty or null usage collections mean no entries.

`baseUrl`, when declared, is the default copied to a Task Plugin channel if the administrator leaves its Base URL empty. Displaying it before installation shows where the channel credential will be sent.

Version entries may include `readme` and `changelog` descriptors. Each contains a repository-relative `path`, a `sha256`, and an optional `translations` map from locale tags to `{path, sha256}`. The index tool reads these files from each version directory and follows the English file's YAML `translations` map. It leaves the descriptor out when the English file does not exist, preserving support for older releases.

New API rc.51 loads these files in the installation dialog. An absent `readme` descriptor means no usage guide is shown; an absent `changelog` descriptor falls back to `CHANGELOG.md` beside `plugin.js`. Keep the files on the index origin.

## Installation checks

The index is generated metadata, not proof that a plugin is safe. Installation still verifies the source hash, compiles the plugin, runs `ValidateV1Meta`, and checks for routing conflicts. The compiled manifest decides what the host accepts.

The index supplies the catalog, version list, and source hashes. `tools/pluginindex` derives display fields from compiled metadata so they match the source. Do not edit those fields by hand.

## Repository layout

```text
plugins/<kind>/<key>/<version>/plugin.js
plugins/<kind>/<key>/<version>/README.md
plugins/<kind>/<key>/<version>/CHANGELOG.md
plugins/<kind>/<key>/icon.svg
index.json
```

The logo is optional and can be PNG instead of SVG. `tasks` is the supported kind directory; plugins do not declare `meta.kind`.

The tool checks that `<key>` and `<version>` match `meta.key` and `meta.version`. Once published, a version directory must not change. Publish fixes in a new directory with a new version.

## Usage guides

New versions include an English `README.md` beside `plugin.js`. It covers channel setup, models and endpoints, usage-based pricing, a request example, and relevant limits. Optional translations use `README.<locale>.md` and are declared in the English file:

```yaml
---
locale: en
translations:
  zh-CN: README.zh-CN.md
---
```

The translated file may declare its own `locale`, but no `translations` map. Guides start with a level-one heading and use Markdown without raw HTML, images, or footnotes. Each file is at most 256 KiB; at most ten translations are allowed. The index tool checks translation references and hashes; it does not validate the Markdown body.

## Release notes

Every new or unpublished version needs an English `CHANGELOG.md` beside `plugin.js`. Consumers find it by replacing the final `plugin.js` in the version path with `CHANGELOG.md`. They must tolerate a missing changelog for older published versions.

Use UTF-8 Markdown with YAML front matter:

```markdown
---
changelogVersion: 1
plugin: "example"
version: "1.2.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.2.0]

### Fixed

- Preserve an explicitly supplied zero seed in upstream requests.
```

Start the file with `---` and close the front matter with the next standalone `---`. Parse it as YAML data without custom tags or executable constructors. Reject unsupported `changelogVersion` values.

| Field | Required value |
| --- | --- |
| `changelogVersion` | Integer `1` |
| `plugin` | String matching the plugin directory and `meta.key` |
| `version` | String matching the version directory and `meta.version` |
| `locale` | BCP 47 language tag; `en` for the canonical file |
| `translations` | Optional map from locale tags to sibling filenames, in the English file only |

The body must have one `# Changelog` heading and one `## [<version>]` heading matching the front matter. Use these level-three category headings in this order, omitting empty ones:

```text
Added
Changed
Deprecated
Removed
Fixed
Security
Migration
```

Each category contains an unordered list. At least one category other than `Migration` must describe a change. Inline Markdown and wrapped list items are allowed; tables, nested lists, and extra headings are not.

Write for users and administrators. Describe one change per bullet, including its pricing, default-parameter, or compatibility effects where relevant. Initial releases should explain what the plugin supports. Use exact model names, paths, and fields when readers need them to use or upgrade it.

Add `Migration` only for required user actions. Put pricing changes first, naming affected models and the prices, tiers, billing modes, or expressions to change. Follow with other compatibility steps. Describe automatic migration only when it affects a user's choice or leaves work to do.

Leave test results, verification limits, and generic release instructions in commit or PR descriptions. Omit lists of unchanged behavior and statements that no action is needed.

Translations use `CHANGELOG.<locale>.md` in the same directory. List them in the English file's `translations` map. Filenames must be basenames, not URLs or paths outside the version directory. Keep metadata, categories, and entry meanings aligned, changing only the locale and prose. YAML keys and headings stay in English. Consumers fall back to English when a translation is unavailable.

Commit the plugin, release notes, translations, and generated index together. Do not rewrite a published directory just to edit release notes. The index checker does not validate changelogs; check their metadata and structure separately.

## Tooling

Clone New API into `../new-api`, beside this repository. The Go module's relative replacements use that checkout and its `relaykit` module. Use the revision pinned in `.github/workflows/validate.yml`.

From the marketplace root:

```bash
cd tools/pluginindex
go run . generate ../..
go run . check ../..
```

`generate` writes `index.json`. `check` recompiles the plugins and fails if the generated bytes differ from the saved index.
