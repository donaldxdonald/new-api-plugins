---
locale: en
translations:
  zh-CN: README.zh-CN.md
---
# Cloudflare AI

Version `0.6.0` requires New API `v1.0.0-rc.51` or later. Install and activate it as a root administrator.

## Models and endpoints

| Model | New API endpoint | Capability |
| --- | --- | --- |
| `@cf/black-forest-labs/flux-1-schnell` | `POST /v1/images/generations` | One Base64 image, 1–8 steps |
| `minimax/h3` | `POST /v1/videos` | 4–15 second videos, 768P or 2K, HTTPS media references |
| `@cf/cloudflare/clef` | `POST /v1/systemone`, `POST /v1/decisions` | Structured decisions |
| `@cf/cloudflare/clef-flash` | Same | Structured decisions |
| `@cf/cloudflare/clef-omni` | Same | Structured decisions; System One also accepts embedded audio and video |

Cloudflare AI and TypeSafe can both serve `/v1/systemone` on this host baseline. Configure each channel with its own plugin and supported models. A plugin-prefixed path such as `/cloudflare-ai/v1/systemone` is also available.

## Channel setup

Create two **Task Plugin** channels and select `cloudflare-ai` on both.

| Setting | Workers AI channel | AI Gateway channel |
| --- | --- | --- |
| Models | Supported `@cf/*` models | `minimax/h3` |
| Base URL | `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai` | Same account URL format |
| Key | Raw Cloudflare API token | Raw Cloudflare API token |
| Plugin settings: Gateway ID | Leave empty; ignored for Workers AI models | Optional Gateway ID |

`ACCOUNT_ID` is a 32-character lowercase hexadecimal account ID. The token needs Workers AI Read permission for that account. Do not add `/v1` or `/run` to the Base URL. Do not paste a vendor key, a Bearer prefix or JSON into Key. New keys are checked for basic formatting when saved; this does not verify permissions or balance.

For H3, an empty Gateway ID uses the account default. The field accepts visible ASCII characters without spaces. Existing channels may keep `cf-aig-gateway-id` in Request Header Override; that override wins when both are set. To use the form value, remove that header override. Do not set that header on the Workers AI channel. Client-supplied Gateway headers are not forwarded.

Workers AI uses `/ai/run/@cf/...`; H3 uses `/ai/run` with `{model, input}`. Configure account funding, BYOK and Unified Billing in Cloudflare. Put each model in one of these two channels.

## Billing

Before serving a model, save a task usage expression at model level or for this plugin provider. Legacy per-call and multiplier billing are unsupported and may return `plugin_usage_invalid`.

| Model | Usage fields |
| --- | --- |
| FLUX | `image_count`, `steps` |
| H3 | `seconds`, `resolution` (`768P` or `2K`) |
| Clef family | `input_tokens` |

For example, selling each FLUX image for USD 0.01 uses:

```text
tier("image", u("image_count") * 0.01)
```

This is an example sales price. Set your own price. Task expressions do not accept `fixed()`.

Clef reserves quota at the model's context limit and settles using the upstream `input_tokens`. H3 settles using reported output duration and resolution when present. FLUX reports image count and steps, not tile usage; these fields do not represent its complete upstream cost.

## Image generation

Send this body to `POST /v1/images/generations`:

```json
{
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "prompt": "A mountain at sunrise",
  "n": 1,
  "steps": 4,
  "response_format": "b64_json"
}
```

Read `data[0].b64_json`. Steps default to 4; only `n: 1` and Base64 output are supported. Unsupported top-level options such as `size`, `output_format` and `seed` are ignored and do not affect billing. Do not infer the image file type from an ignored `output_format`.

On New API rc.51, the OpenAI image entry still limits the upstream JSON response to 1 MiB, including Base64 overhead. Larger images fail even when `MAX_FILE_DOWNLOAD_MB` is higher. The relaxed limit for native routes does not apply to this entry. Immediate image result data is not retained for retrieval; plugin state and retained task data also have separate host limits, normally 1 MiB.

## Video generation

Send this body to `POST /v1/videos`:

```json
{
  "model": "minimax/h3",
  "prompt": "A coastal city at sunrise",
  "seconds": 5,
  "resolution": "768P",
  "ratio": "16:9"
}
```

Defaults are 5 seconds, 768P and 16:9. `duration` may replace `seconds`; do not send both. Once the create response returns, read the saved result at `GET /v1/videos/:id` or download it at `GET /v1/videos/:id/content`.

The connection stays open while H3 generates. Configure client, gateway and reverse-proxy timeouts accordingly. This plugin does not submit or poll Cloudflare background tasks, accept `callback_url` or webhooks, or prevent proxy 524 errors. Saved upstream video URLs may expire.

## Structured decisions

Send this body to `POST /v1/systemone`:

```json
{
  "model": "@cf/cloudflare/clef-flash",
  "state": {"message": "Please help me track my order"},
  "questions": {
    "needs_support": {
      "type": "noul",
      "instructions": "Does the message need customer support?"
    }
  }
}
```

For `POST /v1/decisions`, use the Decisions format:

```json
{
  "model": "@cf/cloudflare/clef-flash",
  "input": "Please help me track my order",
  "questions": [
    {
      "type": "predicate",
      "instructions": "Does the message need customer support?"
    }
  ]
}
```

System One accepts embedded Base64 media, not remote URLs. Decisions does not accept image content. These are not Chat Completions endpoints.

## Other limits

- Image editing, multipart uploads, Responses, Chat Completions and embeddings are not supported.
- An upstream may charge even if the gateway times out or cannot parse its response. Disable automatic retries during initial setup; do not resubmit to check an earlier generation.
