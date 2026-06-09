// compose-ad-creative: 広告カンプ（静止画）の HTML をコンセプト定義から量産する。
//
// 使い方:
//   node compose.mjs <config.json> [outDir]
//   （outDir 省略時は config.json と同じディレクトリの ./out）
//
// 設計:
//   - config（データ）→ renderHTML（純粋関数）→ HTML 書き出し（I/O 境界）
//   - レンダー（HTML→PNG）はこのスクリプトに抱えず、SKILL.md の agent-browser 手順で行う
//   - ブランド（色/書体/ロゴ/CTA）は config.brand に外部化＝プロダクト非依存
//     （呼び出し側が対象プロダクトの docs/product.md から埋める）
//
// 前提レイアウトは 1200x1200（1:1）基準。配置数値はこの寸法に最適化されている。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const [, , configPath, outDirArg] = process.argv;
if (!configPath) {
  console.error("usage: node compose.mjs <config.json> [outDir]");
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const brand = config.brand ?? {};
const viewport = config.viewport ?? { width: 1200, height: 1200 };
const comps = config.comps ?? [];

// 必須チェック（product.md 由来のブランドが欠けたまま走らせない）
for (const key of ["ink", "accent", "paper", "fontFamily", "fontCssUrl"]) {
  if (!brand[key]) {
    console.error(`config.brand.${key} が未設定です（docs/product.md から埋めてください）`);
    process.exit(1);
  }
}
if (comps.length === 0) {
  console.error("config.comps が空です");
  process.exit(1);
}

const outDir = outDirArg
  ? resolve(outDirArg)
  : join(dirname(resolve(configPath)), "out");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 背景パスを file:// URL に正規化（HTML の置き場所と背景が離れても解決できるよう絶対化）
const bgUrl = (bg) => {
  if (/^https?:\/\//.test(bg) || bg.startsWith("file://")) return bg;
  return `file://${isAbsolute(bg) ? bg : resolve(dirname(resolve(configPath)), bg)}`;
};

const headlineHtml = (lines) =>
  lines
    .map(
      (l) =>
        `<div class="hl-line${l.accent ? " accent" : ""}" style="font-size:${l.size ?? 116}px">${esc(l.text)}</div>`,
    )
    .join("\n      ");

const subHtml = (sub) =>
  esc(sub)
    .split("\n")
    .map((line) => `<div>${line}</div>`)
    .join("");

// ロゴ: { pre, accent, post } を pre + <accent色>accent</> + post で組む（例: taberu . pro）
const logoHtml = (logo) => {
  if (!logo) return "";
  const { pre = "", accent = "", post = "" } = logo;
  return `${esc(pre)}<span class="dot">${esc(accent)}</span>${esc(post)}`;
};

const renderHTML = (c) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${esc(brand.fontCssUrl)}" rel="stylesheet" />
<style>
  :root { --ink: ${brand.ink}; --accent: ${brand.accent}; --paper: ${brand.paper}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${viewport.width}px; height: ${viewport.height}px; }
  .stage {
    position: relative; width: ${viewport.width}px; height: ${viewport.height}px; overflow: hidden;
    background-image: url("${bgUrl(c.bg)}"); background-size: cover; background-position: ${c.bgPos || "center"};
    font-family: "${brand.fontFamily}", sans-serif; color: var(--ink);
  }
  /* 左側に淡いベールを敷いて文字の可読性を底上げ（背景の絵柄は活かす） */
  .stage::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(105deg, ${hexToRgba(brand.paper, 0.8)} 0%, ${hexToRgba(brand.paper, 0.52)} 40%, ${hexToRgba(brand.paper, 0)} 64%);
  }
  .copy { position: absolute; left: 96px; top: 132px; width: 840px; z-index: 2; }
  .eyebrow { font-weight: 700; font-size: 38px; letter-spacing: 0.06em; opacity: 0.9; margin-bottom: 34px; }
  .eyebrow:empty { display: none; }
  .eyebrow .bar { display: inline-block; width: 56px; height: 8px; background: var(--accent); border-radius: 4px; vertical-align: middle; margin-right: 22px; transform: translateY(-6px); }
  /* headline は行ごとに nowrap（中途半端な折り返し事故を防ぐ） */
  .hl-line { font-weight: 900; line-height: 1.16; letter-spacing: -0.02em; white-space: nowrap; }
  .hl-line.accent { color: var(--accent); }
  .sub { margin-top: 44px; font-weight: 700; font-size: 44px; line-height: 1.5; letter-spacing: 0.01em; opacity: 0.92; }
  /* CTA ボタン（sub 直下、流入導線として明示） */
  .cta { display: inline-flex; align-items: center; gap: 16px; margin-top: 52px; background: var(--accent); color: #fff; font-weight: 700; font-size: 36px; letter-spacing: 0.02em; padding: 24px 48px; border-radius: 999px; box-shadow: 0 12px 30px ${hexToRgba(brand.accent, 0.36)}; }
  .cta:empty { display: none; }
  .cta .arrow { font-size: 36px; transform: translateY(-1px); }
  /* ロゴは下部中央（左下の X キャプション領域を避ける） */
  .footer { position: absolute; left: 0; right: 0; bottom: 80px; z-index: 2; display: flex; justify-content: center; align-items: center; }
  .logo { font-weight: 900; font-size: 46px; letter-spacing: 0.01em; color: var(--ink); opacity: 0.88; }
  .logo .dot { color: var(--accent); }
</style>
</head>
<body>
  <div class="stage">
    <div class="copy">
      <div class="eyebrow">${c.eyebrow ? `<span class="bar"></span>${esc(c.eyebrow)}` : ""}</div>
      ${headlineHtml(c.headline)}
      <div class="sub">${subHtml(c.sub)}</div>
      <div class="cta">${brand.cta ? `${esc(brand.cta)}<span class="arrow">→</span>` : ""}</div>
    </div>
    <div class="footer">
      <div class="logo">${logoHtml(brand.logo)}</div>
    </div>
  </div>
</body>
</html>
`;

// #rrggbb → rgba(r,g,b,a)。ベールや影の透明度指定に使う
function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

mkdirSync(outDir, { recursive: true });
for (const c of comps) {
  const path = join(outDir, `${c.id}.html`);
  writeFileSync(path, renderHTML(c));
  console.log(`wrote ${c.id}.html  [${c.axis ?? ""}]`);
}
console.log(`\n${comps.length} comps -> ${outDir}`);
