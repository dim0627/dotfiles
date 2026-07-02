#!/usr/bin/env node
// AI Gateway 直叩きの画像生成スクリプト（ai-image-gen スキル同梱）。
// vercel-labs/ai-cli の代替。AI SDK で Gateway を直接叩く。
//
// 使い方:
//   node gen-image.mjs "<prompt>" [-m model[,model...]] [-n count] \
//     [--aspect-ratio 16:9] [--size 1024x1024] [--seed 42] [-o outdir] \
//     [-i ref.png ...] [--mode llm|image]
//
// キーは環境変数 AI_GATEWAY_API_KEY を優先し、無ければカレントディレクトリの
// .env から AI_GATEWAY_API_KEY= の行だけを読む。

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import * as aiSdk from "ai";

const generateImage = aiSdk.generateImage ?? aiSdk.experimental_generateImage;
const { generateText } = aiSdk;

const HELP = `usage: node gen-image.mjs "<prompt>" [options]

options:
  -m, --model <ids>       model id(s), comma-separated (default: google/gemini-2.5-flash-image)
  -n, --count <n>         images per model (default: 1)
      --aspect-ratio <r>  e.g. 16:9 (LLM系は providerOptions で転送、image系は直指定)
      --size <WxH>        e.g. 1024x1024 (image系のみ。gemini系は無視されるので aspect-ratio を使う)
      --seed <n>          seed (image系のみ、モデル対応時)
  -o, --output <dir>      output directory (default: out)
  -i, --image <path>      reference image (LLM系のみ。繰り返し指定可)
      --mode <llm|image>  モデル種別の自動判定を上書き
  -h, --help              show this help`;

function resolveApiKey() {
  if (process.env.AI_GATEWAY_API_KEY) return;
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const line = fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .find((l) => l.startsWith("AI_GATEWAY_API_KEY="));
    if (line) {
      process.env.AI_GATEWAY_API_KEY = line
        .slice("AI_GATEWAY_API_KEY=".length)
        .trim()
        .replace(/^["']|["']$/g, "");
      return;
    }
  }
  console.error(
    "error: AI_GATEWAY_API_KEY が見つからない（環境変数にも ./.env にも無い）"
  );
  process.exit(1);
}

// gemini 系のマルチモーダル LLM は generateText、それ以外（imagen / flux /
// gpt-image / grok-imagine 等の画像専用モデル）は generateImage で叩く。
function isLanguageImageModel(modelId) {
  return /^google\/gemini-/.test(modelId);
}

function slugOf(modelId) {
  return modelId.split("/").pop().replace(/[^a-zA-Z0-9.-]/g, "_");
}

function extOf(mediaType) {
  return (mediaType?.split("/")[1] || "png").replace("jpeg", "jpg");
}

async function runLanguageImageModel(modelId, opts) {
  const google = { responseModalities: ["IMAGE", "TEXT"] };
  if (opts.aspectRatio) google.imageConfig = { aspectRatio: opts.aspectRatio };

  const images = [];
  const usages = [];
  for (let call = 0; call < opts.count; call++) {
    const request = { model: modelId, providerOptions: { google } };
    if (opts.refImages.length > 0) {
      request.messages = [
        {
          role: "user",
          content: [
            { type: "text", text: opts.prompt },
            ...opts.refImages.map((p) => ({
              type: "image",
              image: fs.readFileSync(p),
            })),
          ],
        },
      ];
    } else {
      request.prompt = opts.prompt;
    }
    const result = await generateText(request);
    usages.push(result.usage);
    for (const file of result.files ?? []) {
      if (file.mediaType?.startsWith("image/")) {
        images.push({ bytes: file.uint8Array, mediaType: file.mediaType });
      }
    }
  }
  return { images, usages };
}

async function runImageOnlyModel(modelId, opts) {
  const request = { model: modelId, prompt: opts.prompt, n: opts.count };
  if (opts.aspectRatio) request.aspectRatio = opts.aspectRatio;
  if (opts.size) request.size = opts.size;
  if (opts.seed !== undefined) request.seed = opts.seed;
  const result = await generateImage(request);
  return {
    images: result.images.map((img) => ({
      bytes: Buffer.from(img.base64, "base64"),
      mediaType: img.mediaType,
    })),
    usages: [],
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      model: { type: "string", short: "m", default: "google/gemini-2.5-flash-image" },
      count: { type: "string", short: "n", default: "1" },
      "aspect-ratio": { type: "string" },
      size: { type: "string" },
      seed: { type: "string" },
      output: { type: "string", short: "o", default: "out" },
      image: { type: "string", short: "i", multiple: true },
      mode: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }
  if (values.mode && values.mode !== "llm" && values.mode !== "image") {
    console.error("error: --mode は llm か image");
    process.exit(1);
  }

  resolveApiKey();

  const opts = {
    prompt: positionals.join(" "),
    count: Number.parseInt(values.count, 10),
    aspectRatio: values["aspect-ratio"],
    size: values.size,
    seed: values.seed !== undefined ? Number.parseInt(values.seed, 10) : undefined,
    refImages: values.image ?? [],
  };
  const models = values.model.split(",").map((m) => m.trim()).filter(Boolean);
  const outDir = values.output;
  fs.mkdirSync(outDir, { recursive: true });

  const runId = Date.now().toString(36);
  const results = await Promise.all(
    models.map(async (modelId) => {
      const useLlmPath =
        values.mode === "llm" ||
        (values.mode !== "image" && isLanguageImageModel(modelId));
      try {
        const { images, usages } = useLlmPath
          ? await runLanguageImageModel(modelId, opts)
          : await runImageOnlyModel(modelId, opts);
        const files = [];
        for (const [i, img] of images.entries()) {
          const filename = `${slugOf(modelId)}-${runId}-${i + 1}.${extOf(img.mediaType)}`;
          const filepath = path.join(outDir, filename);
          fs.writeFileSync(filepath, img.bytes);
          console.log(`saved ${filepath} (${Math.round(img.bytes.length / 1024)}kB)`);
          files.push(filename);
        }
        if (files.length === 0) {
          console.error(`warn: ${modelId} は画像を返さなかった`);
        }
        return { model: modelId, files, usages };
      } catch (err) {
        console.error(`error: ${modelId}: ${err.message}`);
        return { model: modelId, files: [], error: err.message };
      }
    })
  );

  const meta = {
    runId,
    createdAt: new Date().toISOString(),
    prompt: opts.prompt,
    params: {
      count: opts.count,
      aspectRatio: opts.aspectRatio ?? null,
      size: opts.size ?? null,
      seed: opts.seed ?? null,
      refImages: opts.refImages,
      mode: values.mode ?? null,
    },
    results,
  };
  fs.writeFileSync(
    path.join(outDir, `meta-${runId}.json`),
    `${JSON.stringify(meta, null, 2)}\n`
  );

  if (results.every((r) => r.error)) process.exit(1);
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
