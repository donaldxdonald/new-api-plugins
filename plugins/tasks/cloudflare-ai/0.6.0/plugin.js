const FLUX = "@cf/black-forest-labs/flux-1-schnell";
const H3 = "minimax/h3";
const RESOLUTIONS = ["768P", "2K"];
const RATIOS = ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const MAX_USAGE_SECONDS = 3600;
const DECISION_CONTEXT = {
  "@cf/cloudflare/clef": 65536,
  "@cf/cloudflare/clef-flash": 24576,
  "@cf/cloudflare/clef-omni": 64000,
};

// Keep metadata literal so the upload dialog can preview it without executing code.
export const meta = {
  apiVersion: 1,
  key: "cloudflare-ai",
  name: "Cloudflare AI",
  icon: "text:CF",
  version: "0.6.0",
  author: { name: "Local custom plugin" },
  description: {
    en: "FLUX images, MiniMax H3 videos and Workers AI Clef typed decisions",
    zh: "FLUX 图片、MiniMax H3 视频和 Workers AI Clef 结构化判断",
  },
  auth: "api_key",
  keyHint: {
    en: "Cloudflare API token only, without Bearer or JSON",
    zh: "填写原始 Cloudflare API token，不加 Bearer，不使用 JSON",
  },
  channelConfig: {
    type: "object",
    properties: {
      gateway_id: {
        type: "string",
        title: { en: "Gateway ID", zh: "Gateway ID" },
        description: {
          en: "H3 only. Leave empty for the account default. Request Header Override takes precedence.",
          zh: "仅用于 H3。留空使用账号默认 Gateway。请求头覆盖优先于此值。",
        },
        default: "",
        pattern: "^[!-~]*$",
      },
    },
  },
  models: [
    "@cf/black-forest-labs/flux-1-schnell",
    "minimax/h3",
    "@cf/cloudflare/clef",
    "@cf/cloudflare/clef-flash",
    "@cf/cloudflare/clef-omni",
  ],
  requiredCapabilities: ["json-order@1"],
  fetchMode: "per_task",
  routes: [
    {
      method: "POST",
      path: "/v1/systemone",
      type: "submit",
      decode: "decodeDecision",
      render: "renderDecision",
      retainResult: false,
      models: ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash", "@cf/cloudflare/clef-omni"],
    },
    {
      method: "POST",
      path: "/v1/decisions",
      type: "submit",
      decode: "decodeOpenAIDecisions",
      render: "renderOpenAIDecisions",
      retainResult: false,
      models: ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash", "@cf/cloudflare/clef-omni"],
    },
  ],
  protocols: [
    { name: "openai_image", models: ["@cf/black-forest-labs/flux-1-schnell"] },
    { name: "openai_video", models: ["minimax/h3"] },
  ],
  usageProfiles: [
    {
      models: ["@cf/black-forest-labs/flux-1-schnell"],
      schema: {
        image_count: {
          type: "number",
          unit: "count",
          description: { en: "Image generation unit price", zh: "图片生成单价" },
        },
        steps: {
          type: "number",
          unit: "count",
          description: { en: "Image generation step unit price", zh: "图片生成步数单价" },
        },
      },
      examples: [{ label: "1 image, 4 steps", facts: { image_count: 1, steps: 4 } }],
    },
    {
      models: ["minimax/h3"],
      schema: {
        seconds: {
          type: "number",
          unit: "second",
          description: { en: "Video generation unit price", zh: "视频生成单价" },
        },
        resolution: {
          enum: ["768P", "2K"],
          description: { en: "Output video resolution", zh: "输出视频分辨率" },
        },
      },
      examples: [
        { label: "5s, 768P", facts: { seconds: 5, resolution: "768P" } },
        { label: "5s, 2K", facts: { seconds: 5, resolution: "2K" } },
      ],
    },
    {
      models: ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash", "@cf/cloudflare/clef-omni"],
      schema: {
        input_tokens: {
          type: "number",
          unit: "token",
          description: { en: "Input token unit price", zh: "输入 token 单价" },
        },
      },
      examples: [{ label: "1,000 input tokens", facts: { input_tokens: 1000 } }],
    },
  ],
};

function requireObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message || "A JSON object is required");
  }
  return value;
}

function allowFields(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error("Unsupported request field: " + key);
  }
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\/[^/?#@\s]+(?:[/?#][^\s]*)?$/.test(value);
}

function validVideoUsageSeconds(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_USAGE_SECONDS;
}

function isDecisionModel(model) {
  return typeof model === "string" && Object.prototype.hasOwnProperty.call(DECISION_CONTEXT, model);
}

function isDecisionContent(value) {
  return typeof value === "string" || (value !== null && typeof value === "object");
}

// Validate embedded media without decoding containers or making URL requests.
// Cloudflare remains responsible for image pixels and audio/video durations.
function decisionMedia(items, kind) {
  const maximum = kind === "videos" ? 2 : 4;
  if (!Array.isArray(items) || items.length > maximum) throw new Error("Too many or invalid Clef " + kind);
  let totalBytes = 0;
  const values = items.map(function (item) {
    let mediaType;
    let encoded;
    if (typeof item === "string") {
      const separator = item.indexOf(";base64,");
      if (!/^data:/i.test(item) || separator < 0) throw new Error("Clef media must be embedded Base64, not remote URLs");
      mediaType = item.slice(5, separator).toLowerCase();
      encoded = item.slice(separator + 8);
    } else {
      requireObject(item);
      allowFields(item, ["content_type", "base64"]);
      mediaType = typeof item.content_type === "string" ? item.content_type.toLowerCase() : "";
      encoded = item.base64;
    }
    const validType =
      kind === "images"
        ? ["image/png", "image/jpeg", "image/webp"].includes(mediaType)
        : new RegExp("^" + (kind === "audio" ? "audio" : "video") + "/[a-z0-9.+-]+$").test(mediaType);
    if (!validType || typeof encoded !== "string" || !encoded) throw new Error("Unsupported Clef media type or empty Base64 payload");
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    const bytes = Math.floor((encoded.length * 3) / 4) - padding;
    const maximumBytes = (kind === "images" ? 4 : kind === "audio" ? 8 : 16) * 1024 * 1024;
    if (bytes > maximumBytes) throw new Error("Clef media item exceeds its decoded byte limit");
    if (encoded.length % 4 === 1 || (padding && encoded.length % 4 !== 0) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new Error("Invalid Clef media Base64 encoding");
    }
    totalBytes += bytes;
    return typeof item === "string" ? "data:" + mediaType + ";base64," + encoded : { content_type: mediaType, base64: encoded };
  });
  return { values, bytes: totalBytes };
}

function decisionInput(model, value) {
  const input = requireObject(value);
  const omni = model === "@cf/cloudflare/clef-omni";
  allowFields(input, omni ? ["model", "state", "questions", "images", "audio", "videos"] : ["model", "state", "questions", "images"]);
  if (!isDecisionContent(input.state)) throw new Error("Clef state must be text, an object, or an array");
  const questions = requireObject(input.questions);
  const ids = Object.keys(questions);
  if (ids.length < 1 || ids.length > 64) throw new Error("Clef requires 1 to 64 questions");
  for (const id of ids) {
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(id)) throw new Error("Invalid Clef question ID");
    const question = requireObject(questions[id]);
    if (!["noul", "choice", "score"].includes(question.type)) throw new Error("Clef question type must be noul, choice, or score");
    if (!isDecisionContent(question.instructions) || (typeof question.instructions === "string" && !question.instructions.trim())) {
      throw new Error("Clef questions require nonempty instructions");
    }
    const criteria = question.criteria;
    if (question.type === "choice") {
      const options = Object.keys(requireObject(criteria));
      if (options.length < 2 || options.length > 255 || options.some(function (key) { return !key || (criteria[key] !== null && !isDecisionContent(criteria[key])); })) {
        throw new Error("Clef choice criteria require 2 to 255 nonempty option IDs with valid descriptions");
      }
    } else if (question.type === "score") {
      if (!Array.isArray(criteria) || criteria.length < 2 || criteria.length > 10 || criteria.some(function (level) { return !isDecisionContent(level); })) {
        throw new Error("Clef score criteria require 2 to 10 non-null levels");
      }
    } else if (criteria !== undefined) {
      requireObject(criteria);
      if ([criteria.true, criteria.false].some(function (entry) { return entry !== undefined && entry !== null && !isDecisionContent(entry); })) {
        throw new Error("Invalid Clef yes/no criteria");
      }
    }
  }
  const result = { model: model.slice("@cf/cloudflare/".length), state: input.state, questions };
  let audioVideoBytes = 0;
  for (const kind of omni ? ["images", "audio", "videos"] : ["images"]) {
    if (input[kind] === undefined) continue;
    const media = decisionMedia(input[kind], kind);
    if (kind === "images" && media.bytes > 8 * 1024 * 1024) throw new Error("Clef images exceed the total decoded byte limit");
    if (kind !== "images") audioVideoBytes += media.bytes;
    result[kind] = media.values;
  }
  if (audioVideoBytes > 16 * 1024 * 1024) throw new Error("Clef audio and videos exceed the combined decoded byte limit");
  return result;
}

function isProbability(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function decisionResult(value, questions) {
  const result = requireObject(value, "Cloudflare decision result must be a JSON object");
  if (typeof result.model !== "string" || !result.model.trim()) throw new Error("Cloudflare decision result is missing model");
  const answers = requireObject(result.answers, "Cloudflare decision result is missing answers");
  const ids = Object.keys(answers);
  if (ids.length < 1 || ids.length > 64) throw new Error("Cloudflare decision result must contain 1 to 64 answers");
  for (const id of ids) {
    const answer = requireObject(answers[id]);
    if (answer.type === "noul") {
      if (!isProbability(answer.noul)) throw new Error("Invalid Clef yes/no probability");
      continue;
    }
    if (!["choice", "score"].includes(answer.type) || !isProbability(answer.confidence)) throw new Error("Invalid Clef answer type or confidence");
    const probabilities = requireObject(answer.probabilities);
    if (!Object.keys(probabilities).length || Object.values(probabilities).some(function (probability) { return !isProbability(probability); })) {
      throw new Error("Invalid Clef answer probabilities");
    }
    if (answer.type === "choice") {
      if (typeof answer.choice !== "string" || !Object.prototype.hasOwnProperty.call(probabilities, answer.choice)) {
        throw new Error("Invalid Clef selected choice");
      }
    } else {
      if (!Number.isFinite(answer.score)) throw new Error("Invalid Clef score");
      requireObject(answer.legend);
    }
  }
  if (questions && typeof questions === "object" && !Array.isArray(questions)) {
    const questionIds = Object.keys(questions);
    if (ids.length !== questionIds.length) throw new Error("Cloudflare decision result has an unexpected or missing matching answer");
    for (const id of questionIds) {
      const question = requireObject(questions[id]);
      if (!Object.prototype.hasOwnProperty.call(answers, id) || answers[id].type !== question.type) {
        throw new Error("Cloudflare decision result is missing a matching answer");
      }
      const answer = answers[id];
      if (question.type === "choice") {
        const expected = Object.keys(requireObject(question.criteria));
        const actual = Object.keys(requireObject(answer.probabilities));
        if (actual.length !== expected.length || expected.some(function (key) {
          return !Object.prototype.hasOwnProperty.call(answer.probabilities, key);
        })) {
          throw new Error("Cloudflare decision choice probabilities do not match criteria");
        }
      } else if (question.type === "score") {
        const expected = question.criteria.map(function (_, index) { return String(index); });
        const actual = Object.keys(requireObject(answer.probabilities));
        if (actual.length !== expected.length || expected.some(function (key) {
          return !Object.prototype.hasOwnProperty.call(answer.probabilities, key);
        })) {
          throw new Error("Cloudflare decision score probabilities do not match criteria");
        }
      }
    }
  }
  // Meter validation belongs to completion settlement, not result acceptance.
  return result;
}

// Clef can read text/JSON transcripts as state. OpenAI image scoping and
// prompt-cache controls have no equivalent here; reject instead of dropping them.
function openAIDecisionContent(value, role) {
  if (typeof value === "string") return;
  if (!Array.isArray(value) || !value.length) throw new Error("Decision content must be text or a nonempty content array");
  for (const entry of value) {
    const part = requireObject(entry);
    if (part.type === "input_image") throw new Error("Decision image parts are unsupported; use System One embedded media");
    if (part.type === "input_json" && role === "user") {
      allowFields(part, ["type", "data"]);
      if (!part.data || typeof part.data !== "object") throw new Error("input_json data must be an object or array");
    } else if (part.type === (role === "assistant" ? "output_text" : "input_text")) {
      allowFields(part, ["type", "text"]);
      if (typeof part.text !== "string") throw new Error("Decision text parts require text");
    } else if (part.type === "refusal" && role === "assistant") {
      allowFields(part, ["type", "refusal"]);
      if (typeof part.refusal !== "string") throw new Error("Decision refusal parts require refusal text");
    } else {
      throw new Error("Unsupported Decision content part for " + role);
    }
  }
}

function openAIDecisionInput(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) throw new Error("Decision input must be text or an ordered input array");
  const calls = new Map();
  for (const entry of value) {
    const item = requireObject(entry);
    if (item.type === undefined || item.type === "message") {
      allowFields(item, ["type", "role", "content"]);
      if (!["user", "developer", "system", "assistant"].includes(item.role)) throw new Error("Unsupported Decision message role");
      openAIDecisionContent(item.content, item.role);
      continue;
    }
    const output = ["function_call_output", "custom_tool_call_output"].includes(item.type);
    const call = ["function_call", "custom_tool_call"].includes(item.type);
    if (!call && !output) throw new Error("Unsupported Decision input item type");
    allowFields(item, output ? ["type", "call_id", "output", "id", "status"] : ["type", "call_id", "name", "arguments", "input", "id", "namespace", "status"]);
    if (typeof item.call_id !== "string" || !item.call_id) throw new Error("Decision tool items require call_id");
    if (item.status != null && !["in_progress", "completed", "incomplete"].includes(item.status)) throw new Error("Invalid Decision tool status");
    for (const key of ["id", "namespace"]) {
      if (item[key] != null && typeof item[key] !== "string") throw new Error("Invalid Decision tool identifier");
    }
    if (output) {
      if (calls.get(item.call_id) !== item.type.replace("_output", "")) throw new Error("Decision tool output must match an earlier call");
      openAIDecisionContent(item.output, "tool");
    } else {
      const field = item.type === "function_call" ? "arguments" : "input";
      if (typeof item.name !== "string" || typeof item[field] !== "string" || calls.has(item.call_id)) throw new Error("Invalid or duplicate Decision tool call");
      if (item[field === "arguments" ? "input" : "arguments"] !== undefined) throw new Error("Unexpected Decision tool call payload");
      calls.set(item.call_id, item.type);
    }
  }
  return value;
}

function openAIDecisionQuestions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) throw new Error("Clef supports 1 to 64 Decision questions");
  const names = new Set();
  const questions = {};
  for (let index = 0; index < value.length; index++) {
    const question = requireObject(value[index]);
    allowFields(question, ["type", "name", "instructions", "choices", "levels"]);
    if (!["predicate", "choice", "score"].includes(question.type)) throw new Error("Decision question type must be predicate, choice, or score");
    if (question.name !== undefined) {
      if (typeof question.name !== "string" || names.has(question.name)) throw new Error("Decision question names must be unique strings");
      names.add(question.name);
    }
    openAIDecisionContent(question.instructions, "question");
    const normalized = { type: question.type === "predicate" ? "noul" : question.type, instructions: question.instructions };
    if (question.type === "choice") {
      if (question.levels !== undefined || !Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 255) {
        throw new Error("Decision choice requires 2 to 255 choices and no levels");
      }
      const seen = new Set();
      normalized.criteria = {};
      for (let option = 0; option < question.choices.length; option++) {
        const choice = requireObject(question.choices[option]);
        allowFields(choice, ["value", "description"]);
        if (!["string", "boolean"].includes(typeof choice.value) || (choice.description !== undefined && typeof choice.description !== "string")) {
          throw new Error("Decision choices require string or boolean values and optional text descriptions");
        }
        const identity = JSON.stringify(choice.value);
        if (seen.has(identity)) throw new Error("Decision choice values must be unique");
        seen.add(identity);
        // Indexed IDs keep true and \"true\" distinct and avoid object-key hazards.
        normalized.criteria["c" + option] = choice;
      }
    } else if (question.type === "score") {
      if (question.choices !== undefined || !Array.isArray(question.levels) || question.levels.length < 2 || question.levels.length > 10) {
        throw new Error("Decision score requires 2 to 10 levels and no choices");
      }
      for (const level of question.levels) {
        requireObject(level);
        allowFields(level, ["label", "description"]);
        if (typeof level.label !== "string" || (level.description !== undefined && typeof level.description !== "string")) throw new Error("Decision levels require text labels and optional descriptions");
      }
      normalized.criteria = question.levels;
    } else if (question.choices !== undefined || question.levels !== undefined) {
      throw new Error("Decision predicate does not accept choices or levels");
    }
    // Public names need not satisfy Clef's ASCII ID or 100-character limit.
    questions["q" + index] = normalized;
  }
  return questions;
}

// Every submit and usage hook validates the same final upstream input.
function generationInput(model, value) {
  if (isDecisionModel(model)) return decisionInput(model, value);
  const input = requireObject(value);
  if (model === FLUX) {
    allowFields(input, ["prompt", "steps"]);
    if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 2048) {
      throw new Error("FLUX prompt must contain 1 to 2048 characters");
    }
    const steps = input.steps === undefined ? 4 : input.steps;
    if (!Number.isInteger(steps) || steps < 1 || steps > 8) {
      throw new Error("FLUX steps must be an integer between 1 and 8");
    }
    return { prompt: input.prompt, steps };
  }
  if (model !== H3) throw new Error("Unsupported Cloudflare model");
  allowFields(input, ["content", "duration", "resolution", "ratio"]);
  if (!Number.isInteger(input.duration) || input.duration < 4 || input.duration > 15) {
    throw new Error("H3 duration must be an integer between 4 and 15");
  }
  if (!RESOLUTIONS.includes(input.resolution)) throw new Error("H3 resolution must be 768P or 2K");
  const ratio = input.ratio === undefined ? "16:9" : input.ratio;
  if (!RATIOS.includes(ratio)) throw new Error("Unsupported H3 aspect ratio");
  if (!Array.isArray(input.content) || input.content.length === 0) {
    throw new Error("H3 content must contain at least one item");
  }
  const roles = [];
  const content = input.content.map(function (value) {
    const item = requireObject(value);
    if (item.type === "text") {
      allowFields(item, ["type", "text"]);
      if (typeof item.text !== "string" || !item.text.trim() || item.text.length > 7000) {
        throw new Error("H3 text must contain 1 to 7000 characters");
      }
      return { type: "text", text: item.text };
    }
    if (item.type === "image_url") {
      allowFields(item, ["type", "image_url", "role"]);
      const image = requireObject(item.image_url);
      allowFields(image, ["url"]);
      if (!isHttpsUrl(image.url)) throw new Error("H3 image references must use HTTPS URLs");
      if (item.role !== undefined && !["first_frame", "last_frame", "reference_image"].includes(item.role)) {
        throw new Error("H3 image role must be first_frame, last_frame, or reference_image");
      }
      if (item.role && item.role !== "reference_image" && roles.includes(item.role)) {
        throw new Error("H3 accepts at most one image for each first or last frame");
      }
      if (item.role) roles.push(item.role);
      return { type: "image_url", image_url: { url: image.url }, ...(item.role === undefined ? {} : { role: item.role }) };
    }
    if (item.type === "video_url") {
      allowFields(item, ["type", "video_url", "role"]);
      const video = requireObject(item.video_url);
      allowFields(video, ["url"]);
      if (item.role !== "reference_video" || !isHttpsUrl(video.url)) {
        throw new Error("H3 reference videos require an HTTPS URL and reference_video role");
      }
      return { type: "video_url", video_url: { url: video.url }, role: "reference_video" };
    }
    if (item.type === "audio_url") {
      allowFields(item, ["type", "audio_url", "role"]);
      const audio = requireObject(item.audio_url);
      allowFields(audio, ["url"]);
      if (item.role !== "reference_audio" || !isHttpsUrl(audio.url)) {
        throw new Error("H3 reference audio requires an HTTPS URL and reference_audio role");
      }
      return { type: "audio_url", audio_url: { url: audio.url }, role: "reference_audio" };
    }
    throw new Error("H3 content supports text, image_url, video_url and audio_url items");
  });
  if (roles.includes("reference_image") && (roles.includes("first_frame") || roles.includes("last_frame"))) {
    throw new Error("Do not mix H3 reference images with first or last frames");
  }
  return { content, duration: input.duration, resolution: input.resolution, ratio };
}

function protocolBody(ctx) {
  const body = ctx.body || {};
  if (body.kind === "json") return requireObject(body.value);
  if (body.kind !== "form" && body.kind !== "multipart") throw new Error("A JSON or form body is required");
  if ((body.files || []).length) {
    throw new Error("Uploaded files are not supported; use HTTPS image references in JSON content");
  }
  const result = {};
  for (const key of Object.keys(body.fields || {})) {
    const values = body.fields[key];
    if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== "string") {
      throw new Error("Form fields must have exactly one string value");
    }
    result[key] = values[0];
  }
  return result;
}

export const protocols = {
  openai_image: {
    decodeRequest(ctx) {
      if (ctx.operation !== "generate") throw new Error("FLUX image editing is not supported");
      if ((ctx.upstreamModel || ctx.model) !== FLUX) throw new Error("Unsupported Cloudflare image model");
      if (ctx.body.kind !== "json") throw new Error("Image generation requires a JSON body");
      const req = protocolBody(ctx);
      // OpenAI clients commonly send provider-specific image options such as
      // output_format, size and metadata. FLUX does not expose those options,
      // so only fields used below are forwarded and all other fields are
      // intentionally ignored for compatibility.
      if (req.n !== undefined && req.n !== 1) throw new Error("FLUX supports n = 1 only");
      if (req.response_format !== undefined && req.response_format !== "b64_json") {
        throw new Error("FLUX supports response_format b64_json only");
      }
      const input = { prompt: req.prompt };
      if (req.steps !== undefined) input.steps = req.steps;
      return {
        kind: "submit",
        model: ctx.model,
        action: "generate",
        requestBody: { input: generationInput(FLUX, input) },
      };
    },
    render(ctx, task) {
      if (!task.data || task.data.kind !== "image" || !task.data.image) throw new Error("Image output is unavailable");
      return { data: [{ b64_json: task.data.image }] };
    },
  },
  openai_video: {
    decodeRequest(ctx) {
      if (ctx.operation !== "create") throw new Error("Unsupported video operation");
      if ((ctx.upstreamModel || ctx.model) !== H3) throw new Error("Unsupported Cloudflare video model");
      const req = protocolBody(ctx);
      if (req.callback_url !== undefined) {
        throw new Error("H3 callback_url is not supported by the synchronous New API task plugin");
      }
      // Ignore extra client fields; only the explicitly constructed input reaches billing and Cloudflare.
      if (req.seconds !== undefined && req.duration !== undefined) {
        throw new Error("Specify seconds or duration, not both");
      }
      let duration = req.seconds === undefined ? req.duration : req.seconds;
      if (duration === undefined) duration = 5;
      if (typeof duration === "string" && /^\d+$/.test(duration)) duration = Number(duration);
      if (req.content !== undefined && (req.prompt !== undefined || req.input_reference !== undefined)) {
        throw new Error("Specify content or prompt with an optional input_reference, not both");
      }
      const content = req.content === undefined ? [{ type: "text", text: req.prompt }] : req.content.slice();
      if (req.input_reference !== undefined) {
        content.push({ type: "image_url", image_url: { url: req.input_reference }, role: "first_frame" });
      }
      const input = {
        content,
        duration,
        resolution: req.resolution === undefined ? "768P" : req.resolution,
        ratio: req.ratio === undefined ? "16:9" : req.ratio,
      };
      return {
        kind: "submit",
        model: ctx.model,
        action: "generate",
        requestBody: { input: generationInput(H3, input) },
      };
    },
    render(ctx, task) {
      if (task.status === "FAILURE") {
        return {
          error: {
            code: "video_generation_failed",
            message: task.fail_reason || "Cloudflare video generation failed",
          },
        };
      }
      if (task.status !== "SUCCESS") return {};
      const data = task.data || {};
      if (data.kind !== "video" || !isHttpsUrl(data.url)) throw new Error("Video output is unavailable");
      const output = { url: data.url, ratio: data.ratio };
      if (validVideoUsageSeconds(data.seconds)) output.seconds = String(data.seconds);
      if (RESOLUTIONS.includes(data.resolution)) output.resolution = data.resolution;
      return output;
    },
  },
};

export const native = {
  decodeDecision(ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("Clef decisions require a JSON body with embedded media");
    const body = requireObject(ctx.body.value);
    if (!isDecisionModel(body.model)) throw new Error("Use a declared @cf/cloudflare/clef model");
    return {
      kind: "submit",
      model: body.model,
      action: "decision",
      requestBody: { input: generationInput(body.model, body) },
    };
  },
  renderDecision(ctx, task) {
    if (task.status !== "SUCCESS" || !task.data || task.data.kind !== "decision") throw new Error("Decision output is unavailable");
    return requireObject(task.data.result);
  },
  decodeOpenAIDecisions(ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("Decisions require a JSON body");
    const body = requireObject(ctx.body.value);
    allowFields(body, ["model", "input", "questions"]);
    if (!isDecisionModel(body.model)) throw new Error("Use a declared @cf/cloudflare/clef model");
    const input = { state: openAIDecisionInput(body.input), questions: openAIDecisionQuestions(body.questions) };
    return {
      kind: "submit",
      model: body.model,
      action: "decision",
      requestBody: { input: generationInput(body.model, input) },
    };
  },
  renderOpenAIDecisions(ctx, task) {
    if (task.status !== "SUCCESS" || !task.data || task.data.kind !== "decision") throw new Error("Decision output is unavailable");
    const result = requireObject(task.data.result);
    const request = ctx.body && ctx.body.value;
    if (!request || !Array.isArray(request.questions)) throw new Error("Decision question metadata is unavailable");
    const answers = request.questions.map(function (question, index) {
      const answer = requireObject(result.answers["q" + index]);
      const name = question.name === undefined ? null : question.name;
      if (question.type === "predicate") return { type: "predicate", name, probability: answer.noul };
      const options = question.type === "choice" ? question.choices : question.levels;
      const probabilities = options.map(function (option, optionIndex) {
        const probability = answer.probabilities[(question.type === "choice" ? "c" : "") + optionIndex];
        if (!isProbability(probability)) throw new Error("Decision result is missing an option probability");
        return question.type === "choice" ? { value: option.value, probability } : { value: optionIndex, label: option.label, probability };
      });
      if (question.type === "choice") {
        const selected = question.choices.find(function (option, optionIndex) { return answer.choice === "c" + optionIndex; });
        if (!selected) throw new Error("Decision result contains an unknown choice");
        return { type: "choice", name, choice: selected.value, probabilities, confidence: answer.confidence };
      }
      return { type: "score", name, score: answer.score, probabilities, confidence: answer.confidence };
    });
    let usage;
    if (
      result.usage &&
      Number.isSafeInteger(result.usage.input_tokens) &&
      result.usage.input_tokens >= 0 &&
      Number.isSafeInteger(result.usage.output_tokens) &&
      result.usage.output_tokens >= 0 &&
      Number.isSafeInteger(result.usage.input_tokens + result.usage.output_tokens)
    ) {
      // Report only upstream counters. Cloudflare supplies no cache/reasoning detail.
      usage = {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        total_tokens: result.usage.input_tokens + result.usage.output_tokens,
      };
    }
    const output = { model: request.model, answers };
    if (usage !== undefined) output.usage = usage;
    return output;
  },
};

export function checkKey(ctx, key) {
  if (typeof key !== "string" || !key || /[\s\x00-\x1f\x7f]/.test(key) || /^[{["]/.test(key)) {
    return {
      error: {
        en: "Enter a raw Cloudflare API token without whitespace, Bearer, or JSON.",
        zh: "请填写原始 Cloudflare API token，不含空白字符、Bearer 前缀或 JSON。",
      },
    };
  }
}

export function buildSubmitRequest(ctx) {
  const model = ctx.upstreamModel || ctx.model;
  const input = generationInput(model, requireObject(ctx.requestBody).input);
  const baseUrl = typeof ctx.baseUrl === "string" ? ctx.baseUrl.replace(/\/+$/, "") : "";
  // Keep the account token on Cloudflare's API host and out of download requests.
  if (!/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[a-f0-9]{32}\/ai$/.test(baseUrl)) {
    throw new Error("Base URL must be https://api.cloudflare.com/client/v4/accounts/<32-character-account-id>/ai");
  }
  if (checkKey(ctx, ctx.apiKey)) {
    throw new Error("A valid Cloudflare API token is required");
  }
  const headers = { Authorization: "Bearer " + ctx.apiKey, "Content-Type": "application/json" };
  const workersAI = model.startsWith("@cf/");
  if (!workersAI) {
    const gatewayId = ctx.config && ctx.config.gateway_id;
    if (gatewayId !== undefined && (typeof gatewayId !== "string" || !/^[!-~]*$/.test(gatewayId))) {
      throw new Error("Gateway ID must contain only visible ASCII characters without spaces");
    }
    if (gatewayId) headers["cf-aig-gateway-id"] = gatewayId;
  }
  return {
    // @cf models use the direct Workers AI model path. Third-party models use
    // the universal /run envelope; the channel may add cf-aig-gateway-id.
    url: baseUrl + "/run" + (workersAI ? "/" + model : ""),
    method: "POST",
    headers,
    body: workersAI ? input : { model, input },
  };
}

export function parseSubmitResponse(ctx, response) {
  const model = ctx.upstreamModel || ctx.model;
  if (model !== FLUX && model !== H3 && !isDecisionModel(model)) throw new Error("Unsupported Cloudflare model");
  let body = response.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body.trim());
    } catch {
      throw new Error("Cloudflare response body is not a valid JSON object");
    }
  }
  requireObject(body, "Cloudflare response body must be a JSON object");
  if (response.statusCode < 200 || response.statusCode >= 300 || body.success === false) {
    throw new Error("Cloudflare rejected the generation request");
  }
  let result = body;
  let depth = 0;
  // Unwrap at most the Cloudflare REST envelope and the AI Gateway run envelope.
  for (; depth < 2 && result.task === undefined && result.image === undefined && result.answers === undefined && result.result !== undefined; depth++) {
    result = requireObject(result.result, "Cloudflare response result must be a JSON object");
    if (result.success === false) throw new Error("Cloudflare rejected the generation request");
  }
  const taskId = result.task && result.task.id ? String(result.task.id) : ctx.publicTaskId;
  if (typeof taskId !== "string" || !taskId) throw new Error("Generation task ID is unavailable");
  // The submit and reservation hooks already validated input. Completion must
  // preserve an upstream success even when the host omits the original request.
  const candidate = ctx.requestBody && ctx.requestBody.input;
  const input = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  if (isDecisionModel(model)) {
    return {
      taskId,
      taskData: { kind: "decision", result: decisionResult(result, input.questions) },
      immediate: { status: "SUCCESS", progress: "100%" },
    };
  }
  if (model === FLUX) {
    if (typeof result.image !== "string" || !result.image || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.image)) {
      throw new Error("Cloudflare returned no valid Base64 image");
    }
    const taskData = { kind: "image", image: result.image };
    if (Number.isInteger(input.steps) && input.steps >= 1 && input.steps <= 8) taskData.steps = input.steps;
    return {
      taskId,
      taskData,
      immediate: { status: "SUCCESS", progress: "100%" },
    };
  }
  const taskType = result.task === null ? "null" : Array.isArray(result.task) ? "array" : typeof result.task;
  const task = requireObject(result.task, "Cloudflare H3 task must be a JSON object (result depth " + depth + ", task type " + taskType + ")");
  if (["failed", "canceled", "cancelled"].includes(task.status)) {
    return {
      taskId,
      taskData: { kind: "video" },
      immediate: { status: "FAILURE", reason: "Cloudflare video generation failed" },
    };
  }
  if (["queued", "running"].includes(task.status)) {
    // Do not raise a submission error that could retry already-started work.
    return {
      taskId,
      taskData: { kind: "video" },
      immediate: {
        status: "FAILURE",
        reason: "Cloudflare returned a background task; this plugin cannot poll it. Check the Cloudflare task before retrying",
      },
    };
  }
  if (task.status !== "succeeded") {
    throw new Error("Expected a completed synchronous H3 result; background tasks and webhooks are not supported");
  }
  if (!task.content || !isHttpsUrl(task.content.url)) throw new Error("Cloudflare returned no HTTPS video URL");
  const reportedSeconds = task.usage && task.usage.output_seconds !== undefined ? task.usage.output_seconds : task.duration;
  const seconds = reportedSeconds === undefined ? input.duration : reportedSeconds;
  const resolution = task.resolution === undefined ? input.resolution : task.resolution;
  const ratio = RATIOS.includes(task.ratio) ? task.ratio : input.ratio;
  // Let the completion hook validate metering without losing a successful video.
  const taskData = { kind: "video", url: task.content.url };
  if (seconds !== undefined) taskData.seconds = seconds;
  if (resolution !== undefined) taskData.resolution = resolution;
  if (RATIOS.includes(ratio)) taskData.ratio = ratio;
  return {
    taskId,
    taskData,
    immediate: { status: "SUCCESS", progress: "100%", remoteUrl: task.content.url },
  };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose !== "facts") {
    throw new Error("Cloudflare AI requires task usage expression pricing; configure a model or plugin provider expression");
  }
  const model = ctx.upstreamModel || ctx.model;
  // Reserve the documented context budget, not an invented tokenizer estimate.
  const request = requireObject(ctx.requestBody);
  // Protocol requests keep the original client JSON for usage hooks when the
  // json-order capability is enabled. Native submits use the canonical input
  // envelope. Read both forms so billing does not depend on that host detail.
  const hasCanonicalInput = request.input && typeof request.input === "object" && !Array.isArray(request.input);
  const input = hasCanonicalInput
    ? request.input
    : request;
  if (isDecisionModel(model)) {
    if (hasCanonicalInput) generationInput(model, input);
    return { input_tokens: DECISION_CONTEXT[model] };
  }
  if (model === FLUX) {
    if (hasCanonicalInput) {
      const validated = generationInput(model, input);
      return { image_count: 1, steps: validated.steps };
    }
    const steps = input.steps === undefined ? 4 : input.steps;
    if (!Number.isInteger(steps) || steps < 1 || steps > 8) {
      throw new Error("FLUX steps must be an integer between 1 and 8");
    }
    return { image_count: 1, steps };
  }
  let duration = input.duration === undefined ? input.seconds : input.duration;
  if (duration === undefined) duration = 5;
  if (typeof duration === "string" && /^\d+$/.test(duration)) duration = Number(duration);
  if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
    throw new Error("H3 duration must be an integer between 4 and 15");
  }
  const resolution = input.resolution === undefined ? "768P" : input.resolution;
  if (!RESOLUTIONS.includes(resolution)) throw new Error("H3 resolution must be 768P or 2K");
  if (!hasCanonicalInput && input.callback_url !== undefined) {
    throw new Error("Unsupported request field: callback_url");
  }
  if (hasCanonicalInput) generationInput(model, input);
  return { seconds: duration, resolution };
}

export function extractUsageOnComplete(ctx, result, data) {
  requireObject(data);
  if (data.kind === "decision") {
    const model = ctx.upstreamModel || ctx.model;
    const tokens = data.result && data.result.usage && data.result.usage.input_tokens;
    if (!isDecisionModel(model) || !Number.isInteger(tokens) || tokens < 0 || tokens > DECISION_CONTEXT[model]) {
      throw new Error("Clef input token usage is missing or outside the reserved context budget");
    }
    return { input_tokens: tokens };
  }
  if (data.kind === "image" && typeof data.image === "string" && data.image) {
    if (data.steps === undefined) return { image_count: 1 };
    if (!Number.isInteger(data.steps) || data.steps < 1 || data.steps > 8) throw new Error("Invalid image billing facts");
    return { image_count: 1, steps: data.steps };
  }
  if (data.kind === "video" && isHttpsUrl(data.url)) {
    if (!validVideoUsageSeconds(data.seconds) || !RESOLUTIONS.includes(data.resolution)) {
      throw new Error("Invalid video billing facts");
    }
    return { seconds: data.seconds, resolution: data.resolution };
  }
  return {};
}

// Required by per_task plugins. Completed synchronous tasks are never polled.
export function buildQueryRequest() {
  throw new Error("This plugin has no upstream polling endpoint; only synchronous Cloudflare results are supported");
}

export function parseTaskResult() {
  return { status: "UNKNOWN" };
}

export function listArtifacts(task) {
  if (task.status === "SUCCESS" && task.data && task.data.kind === "video" && isHttpsUrl(task.data.url)) {
    return [{ key: "video", type: "video", mimeType: "video/mp4" }];
  }
  return [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video" || !ctx.data || ctx.data.kind !== "video" || !isHttpsUrl(ctx.data.url)) {
    throw new Error("Video artifact is unavailable");
  }
  const method = ctx.clientRequest && ctx.clientRequest.method;
  if (method !== "GET" && method !== "HEAD") throw new Error("Video downloads support GET or HEAD only");
  return { url: ctx.data.url, method, credentialless: true };
}
