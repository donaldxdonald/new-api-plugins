# New API upstream plugin research

Checked 2026-11-17 against the official GitHub release/commit API and pinned upstream documentation. All times below are UTC. This research separates shipped releases from main; version labels alone are insufficient because API v1 has additive fields rejected by older strict hosts.

## Verified releases and main

| Version | Published | Tag commit |
|---|---|---|
| v1.0.0-rc.47 (baseline) | 2026-10-25 09:04:29 | e835b1bfc43b565d625537830dbfb19328925134 |
| v1.0.0-rc.48 | 2026-11-04 15:40:15 | 706144769e5bed5a47b78721e3bb11da3cf4c0b9 |
| v1.0.0-rc.49 | 2026-11-08 05:06:38 | 48a6c87f9e7757fdc58e5be9bcb4f8281ad0dfd0 |
| v1.0.0-rc.50 | 2026-11-12 14:15:24 | f2aa91232ed3e5878a614762ace6736a2b74257f |
| v1.0.0-rc.51 (latest published) | 2026-11-13 09:30:24 | c9c6da2786b6a0912215127e78e28fbc6650c85f |

GitHub marks these releases `prerelease: false`, despite their rc names. Main at inspection was `669d774976369e986f03b6e24fff1042f6f94832`, committed 2026-11-17 06:44:49, with 91 commits after rc.47. Sources: [release API](https://api.github.com/repos/QuantumNous/new-api/releases?per_page=6), [main commit](https://github.com/QuantumNous/new-api/commit/669d774976369e986f03b6e24fff1042f6f94832), [baseline comparison](https://github.com/QuantumNous/new-api/compare/v1.0.0-rc.47...669d774976369e986f03b6e24fff1042f6f94832).

## Changes already shipped after rc.47

- **rc.48:** task plugins gained vendor-native API paths and vendor response/error formats, keeping prefixed routes. Native callback URLs are rejected for Kling, Vidu, MiniMax, and Volcengine Ark. Task models now surface missing/incompatible prices. Kling 4.0 bills returned list price; Vertex Gemini Omni bills reported tokens. Relevant commits: `c59f6fd55392` (2026-10-30 13:28:16, native paths, PR 8117), `fe57cba425b5` (2026-10-31 05:25:37, Kling list_price), `ea343c4a8115` (2026-10-31 05:26:58, charge relayed streams when reserve/task insert fails), `c046559bbd8b` (2026-11-02 07:04:51, Omni token billing). [Release](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.48), [native-path PR](https://github.com/QuantumNous/new-api/pull/8117), [stream settlement fix](https://github.com/QuantumNous/new-api/pull/8121).
- **rc.49:** uploaded/marketplace plugins can serve top-level `/v1` paths (e.g. `POST /v1/systemone`), fixing a practical difference from built-ins. Commit `8c8940c999c6`, 2026-11-06 16:39:36. Gemini Omni 1.2 Flash and all input images supported. [Release](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.49), [PR 8241](https://github.com/QuantumNous/new-api/pull/8241).
- **rc.50:** provider plugins, request processing plugins, community marketplace, 8-digit plugin codes, guide/changelog installation display, upstream login/refresh, balance and scheduled maintenance. Request plugins support dry run and usage-log change tracking. Image precharge counts use the final upstream request after overrides, including batch_size/sampleCount/num_outputs. MoeJS runtime upgraded to v0.1.0. Core commit `7b857f5a1e91`, 2026-11-12 12:50:58. [Release](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.50), [PR 8271](https://github.com/QuantumNous/new-api/pull/8271).
- **rc.51:** fixes rc.50 SIGILL on AES-NI/no-AVX CPUs through moego v0.1.0-alpha.3; plugin settings drawer layout fix. Prefer this shipped baseline over rc.50. [Release](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.51).

## Current shipped contract relevant to marketplace plugins

All statements in this section refer to [the pinned rc.51 plugin API documentation](https://github.com/QuantumNous/new-api/blob/c9c6da2786b6a0912215127e78e28fbc6650c85f/docs/plugin-api/v1.md), compared with [rc.47 documentation](https://github.com/QuantumNous/new-api/blob/e835b1bfc43b565d625537830dbfb19328925134/docs/plugin-api/v1.md).

### Routing and gateway chaining

- Vendor paths also receive `/{key}` aliases; host-owned routes normally win. Blocked native routes remain reachable under the prefix and are reported in `skipped_routes`. Explicit exceptions allow native handling of `GET /v1/videos/:task_id` for native-origin tasks and `POST /v1beta/models/{model}:predictLongRunning`.
- Multiple plugins may share native method/path shapes. Each submit decoder is tried in key order; selected channels choose the executing plugin among accepted candidates. Query ownership comes from the persisted task. Decoders must tolerate repeated invocation.
- Shared host protocol competition between ordinary channels and task plugins, provider-specific `<pluginKey>::<model>` pricing, and type-60 gateway chaining **already existed at rc.47**. They must not be presented as newly introduced by rc.48–51.
- `upstreams: ["new_api"]` permits type-60 bindings; `ctx.upstream.kind` explicitly selects gateway rather than vendor authentication/URLs. Gateway requests should continue using plugin-prefixed paths for older upstream compatibility. Jimeng now uses `/jimeng/api/common/v3/submit_task_v2` and `get_result_v2`, which older gateway versions do not serve.
- Native presenters can return `{__status, __headers, __body}` wrappers for vendor HTTP statuses (200–599), with only Location and Retry-After response headers. Consult exact property schema before implementing; native errors have a separate presenter.

### Asynchronous tasks and response sizes

- Responses plugins explicitly declare `stream`, `sync`, and/or `background` modes; unsupported modes fail before billing. These modes already existed at rc.47. They describe client protocol behavior, not permission to return JavaScript Promises from hooks.
- Image host protocols synchronously wait for task completion, polling async vendors. The default `TASK_PLUGIN_PROTOCOL_TIMEOUT_SECONDS` is 600 seconds; a timeout returns 504 `task_timeout` while the durable task continues polling and settles later. Client disconnect likewise leaves it durable.
- `retainResult: false` already existed at rc.47. The current extension allows native immediate response bodies, individual SSE events, and in-memory task data up to `MAX_FILE_DOWNLOAD_MB` (default 64 MB) rather than 1 MiB. Plugin state remains 1 MiB. This does not waive all SSE accumulation limits.
- Results opted out of retention become unavailable on retrieval/artifact surfaces, while billing task rows remain. Async results returned by such a route are retained with a warning. Responses and video protocols retain their deliverables.

### Native SSE and settlement

- SSE parsing and host-managed delta accumulation already existed at rc.47; **native passthrough to the client and its settlement rules changed afterward**.
- On native routes each vendor SSE event reaches the client before the parsing hook; no presenter JSON or appended JSON errors follow it. Host Responses/image routes continue their own presentation flows and do not forward vendor events.
- Once a successful SSE HTTP reply is accepted, failures cannot be retried, preventing duplicate upstream work. After any event is delivered, abnormal truncation/timeout/hook/state/size errors settle at reserved quota without completion/submission usage adjustment; explicit immediate vendor FAILURE settles to zero. Completed streams settle reported usage. Client disconnect does not cancel upstream reading/settlement.
- Default streaming idle timeout is 30 seconds; overall native stream deadline is 600 seconds by default. Snapshot state/result limits are normally 1 MiB; delta control state is 64 KiB, with 256 changes/event and 32 path segments. No JS execution slot remains occupied while awaiting the next upstream event.

### Billing

- Task expressions return USD directly; ordinary relay expressions retain USD-times-one-million semantics. Keep ordinary pricing at model level and task pricing in plugin overrides when channels compete. Missing usage keys are `model_price_error`; task expressions are not automatically converted.
- `ctx.model` preserves client/billing identity; `ctx.upstreamModel` carries mapped machine identity, persisted for polling. Model-specific rate tables should use `ctx.upstreamModel || ctx.model`.
- rc.50 final-request image count fixes apply after request/channel rewrites. Plugin usage hooks still must reserve appropriate request facts and settle actual completion facts.

## Main-only changes after rc.51

- Request plugins can declare `meta.scope: {models?, channelTypes?}` and administrators can confirm it once. The confirmed scope and the currently declared scope each independently must match. Narrowing applies immediately to new requests; widening requires renewed confirmation; removing scope stops that instance. Commit `57345547be11` on 2026-11-15 10:42:56 added scope; `09ac035a2ab2` on 2026-11-15 16:51:09 corrected independent scope matching. Do not ship this field with rc.51 minimum compatibility. [PR 8335](https://github.com/QuantumNous/new-api/pull/8335), [PR 8341](https://github.com/QuantumNous/new-api/pull/8341), [pinned main scope documentation](https://github.com/QuantumNous/new-api/blob/669d774976369e986f03b6e24fff1042f6f94832/docs/plugin-api/v1.md#plugin-scope).
- The main documentation also adds recommended summary length that fits one marketplace line (`b388140acfd8`, 2026-11-13 17:49:05). Main adds doubao-seedream-5-5-261028 (`e00ec88194a8`, 2026-11-13 15:36:35), request-triggered channel-disable protection (`1c63cc8c9036`, 2026-11-15 17:33:17), and Gemini text/thinking conversion fixes on November 17. These are not part of rc.51. [Main comparison](https://github.com/QuantumNous/new-api/compare/v1.0.0-rc.51...669d774976369e986f03b6e24fff1042f6f94832).

## Investigation limits

The initial review was a primary-source documentation/release analysis. The subsequent 0.6.0 implementation added external behavior checks, recorded below. Published 0.5.1 files remain unchanged.


## Assessment of this repository's Cloudflare AI 0.5.1

Local evidence: `plugins/tasks/cloudflare-ai/0.5.1/plugin.js`, `docs/cloudflare-ai.md`, `tools/pluginindex/main.go`, and `.github/workflows/validate.yml`.

- No mandatory plugin source rewrite was identified by contract inspection. Compilation and live behavior compatibility are different checks; host upgrades still need external routing, image-size and billing verification.
- Update the support baseline and documentation after verifying rc.51. The current guide's requirement to disable TypeSafe for `/v1/systemone` describes rc.47; rc.51 supports shared native route candidates and channel-based execution. Uploaded plugin top-level routes were fixed in rc.49.
- The plugin already claims `openai_image`, and the host discards immediately completed image snapshots. However, implementation checks found a documentation/code discrepancy in rc.51: `submitReplyLimit` only relaxes the response limit for a pinned native route with `retainResult: false`, not a pinned image endpoint. The OpenAI image entry still rejects upstream JSON larger than 1 MiB. Raising `MAX_FILE_DOWNLOAD_MB` does not fix it. Preserve that warning until the host implementation changes; adding a protocol metadata switch is not supported.
- The most useful small new implementation is `meta.channelConfig` plus `meta.keyHint` and `checkKey`: expose Gateway ID and validate credential formatting on channel save. Preserve existing Base URL/header configuration during migration. Account ID could also become a form field, but two configuration sources require a clear precedence rule; avoid introducing it without a concrete need.
- A provider part (`meta.relay`) could add ordinary Workers AI chat/embedding relay capabilities alongside the existing task part. This requires new model coverage, verified Cloudflare endpoint conversion and relay billing; host capability alone does not make the current plugin support these models.
- A request-processing plugin is useful for reusable filtering/redaction/parameter policies, but these cross-provider concerns do not need to be embedded in the Cloudflare task implementation.
- For the community marketplace workflow, the next published version needs an English README and optionally a Chinese translation beside plugin.js, with a matching changelog and the required tag/release metadata. The current guide is only under `docs/`, and the local generator only emits the older task index. Community registration/plugin codes are not automatically supplied by that index. Preserve published 0.5.1 unchanged.
- Keep existing usage field names (`image_count`, `steps`, `seconds`, `resolution`, `input_tokens`) stable unless a verified billing change requires migration. The new final-request image count handling does not replace task usage hooks.
- For this repository's custom index, extend the generator to emit optional per-version `readme` and `changelog` descriptors, including translations. rc.51 displays no usage guide when `readme` is absent; changelog loading still falls back to the sibling file. This is a concrete marketplace usability improvement independent of community registration. See the rc.51 contract's Marketplace index v1 paragraph.
- H3 remains synchronous: this source deliberately rejects upstream background tasks and has no polling implementation. Provider hooks, native SSE support, or Responses background modes alone cannot solve H3 timeout/524 behavior. Cloudflare task submission and query semantics must first be verified, then implemented if supported.
- Type-60 gateway chaining is an older optional capability, not a recent addition. This plugin does not declare it, hardcodes the Cloudflare account URL shape and expects vendor envelopes, so adding only `upstreams` would be insufficient.

Initial recommended sequence: verify the unchanged plugin on rc.51 and refresh the guide; prepare a small new version for channel configuration and marketplace packaging; treat ordinary provider relay expansion as a separate feature.

## Local validation

- During the initial review, ran `go run . check ../..` from `tools/pluginindex` against both the pinned rc.47 checkout and a freshly downloaded rc.51 source archive. Both compiled the unchanged 0.5.1 plugin and reported `index.json is up to date`.
- Used temporary Go workspace files outside the repository to resolve the host modules because the documented sibling `../new-api` checkout is absent. This was a validation-only environment adjustment; no module files or CI pins were changed.
- The existing external release-note checker passed English/Chinese metadata, headings, translation mappings and workflow YAML.
- These checks establish compilation and index consistency, not routing, response-size, streaming or billing behavior. No paid upstream inference was performed.

## 0.6.0 implementation and verification

Prepared a new unpublished 0.6.0 directory with Gateway ID channel configuration, key hints and key validation, English/Chinese usage guides, and English/Chinese release notes. The existing header override takes precedence over the Gateway ID field; Workers AI models ignore the field. Usage schemas and pricing hooks are unchanged.

The index generator now uses the upstream document descriptor and translation implementation from new-api-plugins commit `ffa06162bc25d2f17b3346bfa6b120335878e116`. CI and tool dependencies are pinned to rc.51. The generated index includes the new version and document hashes. Published 0.5.1 files were compared byte-for-byte with HEAD and remain unchanged.

External checks ran in `/tmp/new-api-rc51-review`, against rc.51:

| Check | Result |
| --- | --- |
| Gateway ID schema, defaults, header injection, Workers AI exclusion and invalid values | Passed |
| Raw token hints and save-time validation through the host's `CallCheckKey` | Passed |
| Legacy header override precedence through the host's `ApplyHeaderOverride` | Passed |
| Cloudflare 0.6.0 and official TypeSafe 1.2.0 on shared `/v1/systemone`, plus Cloudflare's prefixed route | Passed |
| Host shared native-route rebinding to the selected plugin | Passed |
| Reservation and completion facts against 0.5.1 for FLUX, H3 and Clef, including mapped model identities | Passed |
| Host provider-specific billing selection, frozen settlement and ordinary/plugin price separation | Passed |
| FLUX OpenAI image response: 512 KiB accepted, 2 MiB rejected | Confirmed rc.51's remaining 1 MiB upstream JSON limit |
| Host native route retained/nonretained response limits | Passed |
| Generated index check, both versions' changelog metadata/structure, new bilingual guide structure, file hashes and whitespace | Passed |

Initial H3 test inputs used the client `prompt` shape at an internal hook expecting decoded `content`; the external checks were corrected to use the actual video decoder or its canonical output, and the affected checks passed on rerun. No plugin implementation change was needed for those test-input errors.

The image limit is a verified host behavior that contradicts the broader documentation reading in the initial review. The new usage guides explicitly retain that limit. No custom endpoint workaround or host patch was introduced. No behavior-test code, fixtures or test dependencies were added to this marketplace repository. No paid upstream inference, live deployment or marketplace publication was performed.
