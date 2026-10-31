# Repository rules

Adapted from QuantumNous/new-api-plugins. Edited for this repository.

## No plugin test code

- Do not add or modify plugin test code in this repository, including under `plugins/`, `tools/`, or CI.
- Keep plugin fixtures, test harnesses, and test-only dependencies and CI jobs outside this repository. Run behavior and billing tests in the New API repository or an external temporary directory.
- Marketplace index, schema, and changelog validation are allowed.

## Version files

- Every new version, including one copied from another repository, must have both files:

  ```text
  plugins/<kind>/<key>/<version>/plugin.js
  plugins/<kind>/<key>/<version>/CHANGELOG.md
  ```

- Copy the changelog with the plugin. If none exists, write one from verified changes.
- Never rewrite published version directories, even to edit release notes. These editing rules apply to new and unpublished versions.
- Generate `index.json` with `tools/pluginindex`; do not edit it by hand.
- Commit the plugin, its release notes and translations, and the generated index together when making a release.

## Release notes

- Write repository rules and the complete `CHANGELOG.md` in English. Optional translations use `CHANGELOG.<locale>.md` beside it.
- Follow the [release notes format](docs/marketplace.md#release-notes). Keep YAML keys, version headings, and category headings in English in every locale.
- Set `changelogVersion`, `plugin`, `version`, and `locale`. The plugin key and version must match the directory and `plugin.js`.
- List translations in the English file's `translations` map. Each translation must have matching metadata and categories, apart from its locale and translated text.
- Describe what users can do or what behavior changes. Include pricing, default-parameter, and compatibility effects when relevant. Initial releases must describe their capabilities.
- Use one main change per bullet. Include model names, paths, or fields only when readers need them to use or upgrade the plugin. Check that translations say the same thing.
- Omit empty categories, placeholder entries, test reports, verification limits, generic upgrade instructions, and lists of unchanged behavior. Put test and verification details in commit or PR descriptions.
- Add `Migration` only for required user actions. Put pricing changes first, naming affected models and the prices, tiers, billing modes, or expressions users must change. Follow with compatibility steps.
- Describe automatic migration only when it affects a user's choice or leaves them work to do. Omit statements that no action is needed.

Before completion, run `go run . check ../..` from `tools/pluginindex`. Check changelog metadata and Markdown structure separately; the index tool does not validate them.
