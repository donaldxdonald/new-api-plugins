# Cloudflare AI

版本 `0.5.1`，插件 key 为 `cloudflare-ai`。仅支持下表中的模型。

| 模型 | New API 接口 | 能力 |
| --- | --- | --- |
| `@cf/black-forest-labs/flux-1-schnell` | `POST /v1/images/generations` | 单张文生图，Base64 输出，1 至 8 steps |
| `minimax/h3` | `POST /v1/videos` | 4 至 15 秒视频，768P/2K，HTTPS 媒体参考 |
| `@cf/cloudflare/clef` | `POST /v1/systemone`、`POST /v1/decisions` | 结构化判断 |
| `@cf/cloudflare/clef-flash` | 同上 | 结构化判断 |
| `@cf/cloudflare/clef-omni` | 同上 | 结构化判断，System One 可附内嵌音频和视频 |

## 安装与渠道

用 root 管理员账号安装并激活插件。已验证的 New API 版本为 `v1.0.0-rc.47`，需支持 Task Plugin API v1、`usageProfiles`、`json-order@1`，以及按模型限定的原生路由。

本插件与官方 TypeSafe 插件都使用 `POST /v1/systemone`。rc.47 不能按模型在这两个插件间分流，启用前需停用另一个插件。不要强制跳过冲突检查。

创建两个 Task Plugin 渠道，都选择 `cloudflare-ai`：

| 配置 | Workers AI 直连渠道 | 第三方 AI Gateway 渠道 |
| --- | --- | --- |
| 模型 | 本插件支持的 `@cf/*` 模型 | `minimax/h3` |
| Base URL | `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai` | 相同账号格式 |
| Key | 原始 Cloudflare API token，不加 `Bearer ` | 相同格式 |
| Request Header Override | 不设置 `cf-aig-gateway-id` | 可设置 `cf-aig-gateway-id` |

`ACCOUNT_ID` 是 32 位小写十六进制账号 ID。token 需有该账号的 Workers AI Read 权限。Key 填原始 token，不填厂商 key 或 JSON。Base URL 末尾不要加 `/v1` 或 `/run`。

在第三方渠道的 Request Header Override 中指定 Gateway：

```json
{
  "cf-aig-gateway-id": "YOUR_GATEWAY_ID"
}
```

省略时使用账号默认 Gateway。每个模型只放入一个渠道。插件不转发客户端的 Gateway 路由 header。

Workers AI 模型使用 `POST /ai/run/@cf/...`；H3 使用 `POST /ai/run`，请求体为 `{model, input}`。账号余额、BYOK 和 Unified Billing 需在 Cloudflare 配置。

## 定价

开放模型前，保存模型级或插件 provider 的任务用量表达式。旧的按次和倍率计费不受支持，可能返回 `plugin_usage_invalid`。

| 模型 | 用量字段 |
| --- | --- |
| FLUX | `image_count`、`steps` |
| H3 | `seconds`、`resolution`，后者为 `768P` 或 `2K` |
| Clef 系列 | `input_tokens` |

例如 FLUX 按张销售可使用：

```text
tier("image", u("image_count") * 0.01)
```

此例按每张 USD 0.01 收费，不是 Cloudflare 官方报价。请改成自己的销售价格。任务用量表达式不接受 `fixed()`。

Clef 按模型上下文上限预留额度，完成后按上游报告的 `input_tokens` 结算。

FLUX 还涉及 tile 计费，但插件只报告图片数和步数。这些字段不是完整的上游成本。

## 图片

```json
{
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "prompt": "A mountain at sunrise",
  "n": 1,
  "steps": 4,
  "size": "1024x1024",
  "output_format": "png",
  "response_format": "b64_json"
}
```

发送到 `POST /v1/images/generations`，从 `data[0].b64_json` 读取图片。默认 `steps` 为 4，只支持 `n: 1` 和 Base64 输出。

插件忽略 `size`、`output_format`、`seed` 等不支持的顶层选项，不转发、不计入用量。即使请求写了 `"output_format": "png"`，也不能据此把返回文件当作 PNG。

## 视频

```json
{
  "model": "minimax/h3",
  "prompt": "A coastal city at sunrise",
  "seconds": 5,
  "resolution": "768P",
  "ratio": "16:9"
}
```

发送到 `POST /v1/videos`，默认生成 5 秒、768P、16:9 视频。`duration` 可替代 `seconds`，不能同时传入。

用创建响应的 `id` 请求 `GET /v1/videos/:id` 查看结果，或请求 `GET /v1/videos/:id/content` 读取视频。

H3 生成期间连接保持打开，需检查客户端、New API 和反向代理的超时设置。插件不支持后台任务、`callback_url` 或 webhook，也不解决代理返回的 524。

## 结构化判断

System One 示例，发送到 `POST /v1/systemone`：

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

调用 `POST /v1/decisions` 时，改用 Decisions 请求格式：

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

System One 只接受内嵌 Base64 媒体，不接受远程 URL。Decisions 不接受图片内容。这两个接口都不是 Chat Completions。

## 限制

- 不支持图片编辑、multipart 文件、Responses、Chat Completions 或 embeddings。
- 不能查询 Cloudflare 后台任务。New API 保存的 H3 视频 URL 仍可能过期。
- rc.47 的插件响应及持久化 JSON 限制可能影响较大的 Base64 图片。
- 超时或解析失败时，上游可能已经生成并收费。初次联调先关闭自动重试，不要重复提交来检查已有任务。
- 本仓库未做线上收费推理测试。
