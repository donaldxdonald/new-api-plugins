---
locale: zh-CN
---
# Cloudflare AI

版本 `0.7.1`，插件 key 为 `donaldxdonald_cloudflare-ai`。聊天支持自定义模型名称，任务模型和接口见下表。

| 模型 | New API 接口 | 能力 |
| --- | --- | --- |
| 渠道中配置的任意聊天模型名称 | `POST /v1/chat/completions` | OpenAI 兼容聊天，支持普通和流式响应 |
| `@cf/black-forest-labs/flux-1-schnell` | `POST /v1/images/generations` | 单张文生图，Base64 输出，1 至 8 steps |
| `minimax/h3` | `POST /v1/videos` | 4 至 15 秒视频，768P/2K，HTTPS 媒体参考 |
| `@cf/cloudflare/clef` | `POST /v1/systemone`、`POST /v1/decisions` | 结构化判断 |
| `@cf/cloudflare/clef-flash` | 同上 | 结构化判断 |
| `@cf/cloudflare/clef-omni` | 同上 | 结构化判断，System One 可附内嵌音频和视频 |

## 安装与渠道

用 root 管理员账号安装并激活插件。需要 New API `v1.0.0-rc.51` 或更新版本。

本插件与官方 TypeSafe 插件可同时使用 `POST /v1/systemone`。为各渠道选择对应插件和支持的模型。也可以使用带插件前缀的路径，例如 `/donaldxdonald_cloudflare-ai/v1/systemone`。

创建两个 Task Plugin 渠道，都选择 `donaldxdonald_cloudflare-ai`：

| 配置 | Workers AI 直连渠道 | 第三方 AI Gateway 渠道 |
| --- | --- | --- |
| 模型 | Cloudflare 聊天模型名称和支持的 `@cf/*` 任务模型 | `minimax/h3` |
| Base URL | `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai` | 相同账号格式 |
| Key | 原始 Cloudflare API token，不加 `Bearer ` | 相同格式 |
| 插件设置：Gateway ID | 留空；Workers AI 模型忽略此字段 | 可选 Gateway ID |

`ACCOUNT_ID` 是 32 位小写十六进制账号 ID。token 需有该账号的 Workers AI Read 权限。Key 填原始 token，不填厂商 key 或 JSON。Base URL 末尾不要加 `/v1` 或 `/run`。保存新密钥时会检查基本格式，但不会验证权限或余额。

在 H3 渠道的插件设置中填写 Gateway ID；留空使用账号默认 Gateway。此字段接受不含空格的可见 ASCII 字符。

已有渠道可继续在 Request Header Override 中设置 `cf-aig-gateway-id`。同时设置时，请求头覆盖优先于表单值；要使用表单值，请移除该请求头覆盖。Workers AI 渠道不要设置该请求头。每个模型只放入这两个渠道中的一个。插件不转发客户端的 Gateway 路由 header。

Workers AI 聊天使用 `POST /ai/v1/chat/completions`，Workers AI 任务使用 `POST /ai/run/@cf/...`；H3 使用 `POST /ai/run`，请求体为 `{model, input}`。账号余额、BYOK 和 Unified Billing 需在 Cloudflare 配置。

## 聊天与提示词缓存

可在 Workers AI 渠道中添加任意聊天模型名称。插件不限制聊天模型名单或名称前缀，实际模型需由 Cloudflare 的 OpenAI 兼容聊天接口提供。插件提供的模型列表包含 `@cf/deepseek-ai/deepseek-v4.1-flash-1017` 和 `@cf/zai-org/glm-4.7-flash` 等示例。要使用自定义客户端别名，在渠道的 **Model Mapping（模型映射）** 中映射到上游模型名称。为每个新增模型配置普通中转 token 定价。

要使用会话亲和性，建议单独建一个聊天渠道，并在 **Request Header Override（请求头覆盖）** 中填写：

```json
{"x-session-affinity": "{client_header:x-session-affinity}"}
```

这样只在客户端传入时复制这个头。为每个对话或智能体会话生成一个不含个人信息的 ID，同一会话重复使用，不要给整个渠道写死一个值。下面的请求发给 **New API**，而不是 Cloudflare：

```bash
curl "$NEW_API_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $NEW_API_KEY" -H "Content-Type: application/json" \
  -H "x-session-affinity: $SESSION_ID" \
  -d '{"model":"@cf/deepseek-ai/deepseek-v4.1-flash-1017","messages":[{"role":"user","content":"你好！"}]}'
```

Workers AI 会为支持的模型自动启用[前缀缓存](https://developers.cloudflare.com/workers-ai/features/prompt-caching/)。会话 ID 只提高命中概率，不保证命中。把不变的系统提示和工具定义放在最前面，新消息追加在末尾。无需设置 Gateway 响应缓存 TTL 或 `cf-aig-cache-key`。流式调用可加 `"stream":true,"stream_options":{"include_usage":true}`，在上游返回用量时查看 `usage.prompt_tokens_details.cached_tokens`。第一次请求或提示词很短时，可能没有缓存用量。

## 定价

聊天使用**普通中转的 token 定价**，不是任务表达式。若按 [DeepSeek 官方单价](https://developers.cloudflare.com/workers-ai/models/deepseek-v4.1-flash-1017/)销售，可填 `tier("chat", p * 0.30 + cr * 0.006 + c * 1.20)`：每百万未缓存输入、缓存命中输入、输出分别为 0.30、0.006、1.20 美元。使用 `cr` 时 New API 会从 `p` 中扣除已命中部分。DeepSeek 需要付费访问。GLM 应按[自己的模型页](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)单独定价，不要照搬 DeepSeek 的缓存价。

开放图片、视频和判断任务前，保存模型级或插件 provider 的任务用量表达式。这些任务不支持旧的按次和倍率计费，可能返回 `plugin_usage_invalid`。

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

Clef 按模型上下文上限预留额度，完成后按上游报告的 `input_tokens` 结算。H3 在上游报告输出时长和分辨率时使用这些值结算。

FLUX 还涉及 tile 计费，但插件只报告图片数和步数。这些字段不是完整的上游成本。

## 图片

```json
{
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "prompt": "A mountain at sunrise",
  "n": 1,
  "steps": 4,
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

创建请求返回后，用响应的 `id` 请求 `GET /v1/videos/:id` 查看结果，或请求 `GET /v1/videos/:id/content` 读取视频。

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
- New API rc.51 的 OpenAI 图片入口仍将上游 JSON 响应限制为 1 MiB，包含 Base64 开销。即使提高 `MAX_FILE_DOWNLOAD_MB`，更大的图片仍会失败；原生路由放宽后的限制不适用于此入口。即时图片结果不会保留供后续查询；插件 state 和保留的任务数据也有独立限制，通常为 1 MiB。
- 超时或解析失败时，上游可能已经生成并收费。初次联调先关闭自动重试，不要重复提交来检查已有任务。
