---
name: migrate-to-cloudflare
description: Vercel でホスティングしているサイト（Next.js / Astro 等）を Cloudflare Workers へ移行する。静的化の可否判定・wrangler 設定・GitHub Actions・カスタムドメイン切り替えまでを、実際に踏んだ罠込みで手順化したもの。「CFに移行」「Cloudflareに移す」「Vercelやめる」で起動。
user-invocable: true
allowed-tools: Bash(git *), Bash(gh *), Bash(pnpm *), Bash(npx wrangler *), Bash(dig *), Bash(curl *), Bash(sips *), Bash(du *), Bash(find *), Bash(ls *), Read, Write, Edit, Grep, Glob, mcp__cf-docs__*
---

Vercel 上のサイトを Cloudflare Workers へ移行する。

実績（すべて 2026-07-26）:

- **unresolved.xyz**（blog / yet の 2 サイト）— Next.js App Router + Turborepo + pnpm。本スキルの原型
- **wasuremono.art** — Astro（`output: 'static'`）+ pnpm・単一リポジトリ

本線は「**完全静的化して `dist`／`out` をアセットとして置くだけ**」であってフレームワーク固有ではない。Next.js 固有の記述には印を付けてある。Astro のように最初から静的出力なら Phase 1 の設定変更はほぼ不要。

> **これは移行期間限定のスキル。** Vercel からの移行が全部終わったら削除してよい（本体は `dotfiles/claude/skills/migrate-to-cloudflare/`、`~/.claude/skills/` 配下はシンボリックリンク）。

## 移行の判断材料（聞かれたとき用）

- Cloudflare は **静的アセットへのリクエストが課金対象外かつ無制限**（公式: "Requests to static assets are free and unlimited"）。Vercel のようにアカウント単位の使用量上限で全プロジェクトが巻き込まれて停止する事故が構造的に起きない
- 完全静的化できればアダプタ不要になり、ベンダーロックインが消える
- **新規は Pages ではなく Workers（Static Assets）**。Cloudflare 自身が Workers を推奨している

## Phase 0. 静的化できるか判定する

ここで結論が変わる。**最初に必ずやる。**

### Astro の場合

```bash
grep -n "output:" astro.config.*   # 'static' なら完全静的。'server'/'hybrid' なら要調査
# 動的機能の気配（1 件も出なければ完全静的が確定）
grep -rn "prerender\|APIRoute\|Astro.request\|Astro.cookies\|astro:middleware\|server:defer\|actions" src/
find src -name "middleware.*"
```

`output: 'static'` かつ上記が空なら、**アダプタも設定変更も要らない**。`wrangler.jsonc` を置くだけで Phase 1 は終わる（`@astrojs/vercel` を入れている場合だけ外す）。

### Next.js の場合

```bash
# 動的機能の有無を一括で確認
grep -rn "next/image\|revalidate\|export const dynamic\|middleware\|NextRequest\|cookies()\|headers()\|generateStaticParams\|ImageResponse\|next/og" \
  apps/*/app apps/*/libs apps/*/components 2>/dev/null

# Route Handler / sitemap / robots が無いか（あれば静的化の障害）
find apps/*/app -name "route.ts" -o -name "sitemap.ts" -o -name "robots.ts"

# OG 画像が静的 PNG か動的生成か
find apps/*/app -name "opengraph-image*"
```

判定:

| 状況 | 対応 |
|---|---|
| Route Handler / ISR / middleware / `cookies()` なし | **`output: 'export'` で完全静的化**（本スキルの本線） |
| `next/image` を使っている | `images.unoptimized: true` が必要。表示サイズが小さいアイコン中心なら実害ほぼ無し。大きい画像を最適化に頼っていたなら事前縮小が要る |
| `opengraph-image.png`（静的） | そのまま動く |
| `ImageResponse` で動的生成 | ビルド時生成に書き換えるか、下の SSR ルートへ |
| SSR / ISR / Server Actions が必須 | `@opennextjs/cloudflare` を使う（本スキルの範囲外。複雑さが増すので、静的化できるなら絶対に静的化する） |

## Phase 1. 実装

### next.config.js

```js
module.exports = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
};
```

### wrangler.jsonc（アプリごと）

```jsonc
{
  // モノレポなら "../../node_modules/..."、単一リポジトリなら "./node_modules/..."
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "<worker-name>",
  "compatibility_date": "<today>",
  // Worker スクリプトを持たない静的アセット専用の Worker。
  // main が無いため assets.binding は指定できない（指定すると deploy が失敗する）。
  "assets": {
    "directory": "./out",   // Astro なら "./dist"
    // これが無いと生成済みの 404.html が使われず素の 404 になる
    "not_found_handling": "404-page",
    // 内部リンクが末尾スラッシュ無しなら必要。下の罠 0-a で判断する
    "html_handling": "drop-trailing-slash"
  }
}
```

Worker 名は既存の命名に合わせる（`api-taberu-pro` 等にならい、ドットをハイフンに）。

`wrangler` はリポジトリに devDependency として入れる（`pnpm add -D wrangler@^4`）。ローカルでもコマンドを `pnpm exec wrangler ...` に揃えられて、CI とバージョンがずれない。

**カスタムドメインはこの時点では書かない。** まず workers.dev で確認してから Phase 4 で繋ぐ。

### 🪤 罠（全部踏んだ）

**構成を問わず効くもの**

0-a. **`html_handling` の既定値が、内部リンクの URL 形と噛み合っているか確かめる**

既定は `auto-trailing-slash` で、`index.html` を末尾スラッシュ付きの URL に **307 で寄せる**。サイト側の内部リンクと `<link rel="canonical">` がスラッシュ**無し**で書かれていると、**内部リンクを踏むたびにリダイレクトが挟まる**（Vercel は両形とも 200 で返すので移行前は表面化しない）。

```bash
# 実物を見てから決める。この2つが食い違っていることがある
curl -s <本番URL>/<記事ページ> | grep -o '<link rel="canonical"[^>]*>'
curl -s <本番URL>/ | grep -o 'href="/[^"]*"' | head
curl -s <本番URL>/sitemap-0.xml | grep -o '<loc>[^<]*</loc>' | head -3
```

内部リンクがスラッシュ無しなら `"html_handling": "drop-trailing-slash"` を入れる（`"auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | "none"` の4値）。wasuremono.art は Astro が sitemap **だけ**スラッシュ付きを吐いていて、内部リンク・canonical はスラッシュ無しだった。多い側（内部リンク）に合わせる。

0-b. **Vercel が黙って弾いていた dotfile が、Workers では 200 で配信される**

`.DS_Store` が実際に露出した（Vercel では 404）。アセットディレクトリ直下に `.assetsignore` を置く。生成されるディレクトリなので、**ソース側の静的ディレクトリに置いてビルドでコピーさせる**（Astro なら `public/.assetsignore` → `dist/.assetsignore`）。

```
**/.DS_Store
**/.gitkeep
**/node_modules
**/.git
```

`.assetsignore` 自体も配信対象から外れる。CI ビルドには `.DS_Store` が無いので**ローカルから `wrangler deploy` したときだけ漏れる**＝気づきにくい。

**Next.js + Turborepo 構成の罠**

1. **`turbo.json` の `outputs` に `out/**` を足す**
   ```jsonc
   "build": { "outputs": ["dist/**", ".next/**", "out/**"] }
   ```
   無いとキャッシュヒット時に成果物が復元されず、**デプロイが空になる**。原因が見えにくい最悪の罠。

2. **biome / eslint の対象から `out` を除外する**
   `biome.json` の `files.includes` に `"!**/out"`。忘れると生成物を lint して**1万件超のエラー**が出る。
   ※ biome が `vcs.useIgnoreFile: true` で、かつ出力先が `.gitignore` 済みなら自動的に除外されるので不要（wasuremono.art はこれで不発だった）。

3. **`start: next start` は静的エクスポートで動かない**
   `"start": "wrangler dev"` に置き換える。本番と同じ workerd で確認できるようになる。
   ※ 静的出力なら Astro の `preview: astro preview` も同様に `wrangler dev` へ寄せる価値がある（配信するのは本番と同じ workerd になる）。

4. **pnpm の `onlyBuiltDependencies` に `workerd` を追加**
   ```jsonc
   "pnpm": { "onlyBuiltDependencies": ["lefthook", "workerd"] }
   ```
   無いと postinstall がスキップされ `wrangler dev` が動かない。

### .gitignore

```
.wrangler
.dev.vars*
```

### deploy.yml

既存の taberu.pro / egoa と同じ `cloudflare/wrangler-action@v4` の型に揃える。

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: false

# デプロイ先の認証は CLOUDFLARE_API_TOKEN が担うので、GITHUB_TOKEN は最小限に
permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: ".node-version"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/<app>
          packageManager: pnpm
          # 指定なしだと古い v3 が入り wrangler.jsonc を解釈できず落ちることがある
          wranglerVersion: "4"
          command: deploy
```

**単一リポジトリの場合**は `workingDirectory` を落とす。`.node-version` が無いリポジトリでは `node-version-file` ではなく `node-version: 22` のように既存 CI と同じ書き方に揃える。

また、`deploy.yml` を CI と**別ファイルに分けると品質ゲートが効かない**（並走するので lint が落ちてもデプロイが走る）。分けるなら deploy 側にも lint / check を入れて、build の前に通す。wasuremono.art はビルドが 10 秒なので重複を許容してこの形にした。

**GitHub Actions を選ぶ理由**（Workers Builds の Git 連携ではなく）:
- 3 リポジトリの運用系統が 1 つに揃う
- モノレポで CF ダッシュボード側との設定二重管理を避けられる
- 既存 CI の品質ゲート（build / syncpack / lint / audit）を通ったものだけデプロイできる

**⚠️ public リポジトリの場合**: taberu.pro / egoa は private 前提で Slack webhook URL をワークフローに直書きしている。**public では絶対に流用しない**。`secrets.SLACK_WEBHOOK_URL` 経由にする。値を画面に出さずに登録するには:

```bash
grep -ohE 'https://hooks\.slack\.com/services/[A-Za-z0-9/_-]+' ../taberu.pro/.github/workflows/deploy-api.yml \
  | head -1 | tr -d '\n' | gh secret set SLACK_WEBHOOK_URL
```

### secrets

```bash
npx wrangler whoami          # Account ID はここで取れる（秘密情報ではない）
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN   # ← 値は本人が入れる。会話ログに残さない
```

トークンに必要な権限:
- `Account → Workers Scripts → Edit`（デプロイ）
- `Zone → Workers Routes → Edit` / `Zone → DNS → Edit`（Phase 4 のカスタムドメイン）

**最初から両方入れておく。**後から作り直すと二度手間。

## Phase 2. ローカル検証（workerd で）

```bash
pnpm build
pnpm --filter <app> exec wrangler dev --port 8791
```

**⚠️ バックグラウンド起動は `&` ではなく run_in_background を使う。** `&` だとシェル終了時に殺され、たまたま別プロセスが同じポートを掴んでいると**まったく別のサイトを検証してしまう**（実際にやらかした）。必ず `<title>` を見て対象が合っているか確認する。

```bash
probe() { printf "%-45s -> %s\n" "$1" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8791$1")"; }
probe "/"; probe "/<動的ルートの実例>"; probe "/images/..."; probe "/opengraph-image.png"; probe "/favicon.ico"; probe "/this-does-not-exist"
curl -s http://127.0.0.1:8791/ | grep -o "<title>[^<]*</title>"
```

存在しないパスが **404 かつ生成済みの 404 ページ**を返せば `not_found_handling` が効いている。

**現行の本番と挙動を突き合わせる。**移行前後で差が出るのはたいてい「Vercel が暗黙にやっていたこと」なので、同じパスを両方に投げて比べるのが一番早い（これで `html_handling` と dotfile の2件が見つかった）。

```bash
for p in / /<記事> /<記事>/ /index.html /.DS_Store /this-does-not-exist; do
  printf "%-30s CF=%s Vercel=%s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8791$p)" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://<本番ホスト>$p)"
done
```

## Phase 3. workers.dev でデプロイ・確認

マージして Actions を通す。この時点では DNS を触っていないので**既存サイトは無傷**。デプロイログに出る `https://<worker>.<subdomain>.workers.dev` を叩いて全パスを確認する。

**⚠️ デプロイ直後は伝播待ちで一部のパスが 404 を返す。**全ルートを叩くと数件だけ 404 になることがあり、20 秒ほどで解消した。**バラバラに 404 が散る＝伝播中**（設定ミスなら特定の型のパスが揃って落ちる）。慌てて切り戻さず、まず時間を置いて再確認する。

## Phase 4. カスタムドメイン切り替え

### 事実

- Custom Domain は **対象ホスト名に既存レコードがあると作成に失敗する**（公式明記）。先にレコード削除が必須
- 公式手順も「①レコード削除 → ②`routes` + `custom_domain: true` 追記 → ③`wrangler deploy`」
- DNS レコードと証明書は Cloudflare 側が自動作成する
- **apex に載せる場合は CNAME ではなく A レコードが複数本刺さっている**（Vercel の anycast IP。`216.150.x.x`）。全部消す。サブドメインの CNAME 1本だけ、と思い込まないこと
- **DNS の削除は wrangler の OAuth トークンではできない**（`zone` は read のみ）。ダッシュボードで本人が消すか、DNS 編集権限付きの API トークンが要る。ここは事前に段取りしておく

```jsonc
"routes": [{ "pattern": "blog.example.com", "custom_domain": true }],
// 切り分け用に workers.dev は当面残す。落ち着いたら false に
"workers_dev": true
```

**`workers_dev: true` は書かないと消える。**`routes` を足して `workers_dev` を明記しないと、次の deploy で **`false` に推論される**（公式明記）。切り分け用に生かしておきたいなら明示が必要。

逆に、有効なままだと**同じサイトが 2 つの URL で公開され続ける**。さらに wrangler v4.44.0 以降は **Preview URL の既定値が `workers_dev` に追従する**ので、`true` の間はバージョンごとの Preview URL も公開されている。落ち着いたら `false` にして両方まとめて閉じる。

（ダッシュボードで無効化しても、wrangler 設定に `workers_dev: false` が無ければ**次の deploy で復活する**）

### 🪤 最大の罠: ネガティブキャッシュ

レコードを削除すると「存在しない」という事実が **SOA の minimum 値**でキャッシュされる。unresolved.xyz は **1800 秒 = 30 分**だった。通常の TTL（300 秒）ではない。

- 「切り戻したのに戻らない」の犯人はだいたいこれ
- **自分の家のルーターがキャッシュすると自分だけ見えなくなる。**サイトが落ちたと勘違いしやすい
- 切り分けは必ずパブリックリゾルバで:

```bash
dig @8.8.8.8 +short <host>      # 第三者視点
dig @1.1.1.1 +short <host>
dig @<権威NS> +short <host> +norecurse
# ローカルDNSを迂回して実アクセス
curl -s -o /dev/null -w '%{http_code}' --resolve <host>:443:<IP> https://<host>/
```

ローカルの復旧: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` かルーター再起動。

### ダウンタイムを最短にする順序

1. workers.dev で完全に確認を済ませておく
2. `routes` を書いた変更を**手元に用意しておく**
3. DNS レコードを削除（ここからダウン）
4. **即** `wrangler deploy`（ローカルから直接叩くのが最速。Custom Domain 作成は冪等なので、後から同じ内容を PR にしてもズレない）
5. `--resolve` で復旧確認 → PR 化してコードとインフラを揃える

証明書は、対象が 1 階層のサブドメインで既存の Universal SSL がカバーしていれば**発行待ちのダウンは発生しない**（実測）。**apex（`example.com` 自体）でも同じく発行待ちゼロだった**（wasuremono.art で実測）。

切り替え成功のサインは `wrangler deploy` の出力に出る `<host> (custom domain)` の行と、`dig` が Cloudflare の anycast IP（`104.21.x` / `172.67.x`）を返すこと。応答ヘッダは `server: cloudflare` になる。

## Phase 5. 掃除（移行のついでに）

```bash
gh secret list                        # 何年も前の死んだ secrets が残っていがち
ls apps/*/.env.local                  # 使っていない env は wrangler が拾って Worker にバインドしてしまう
grep -rn "secrets\." .github/workflows/  # CI が参照しているのに存在しない secret
```

`wrangler dev` 起動時に `Using secrets defined in .env.local` と出たら、不要な環境変数が Worker に入っている。ローカルから `wrangler deploy` すると本番にアップロードされうるので消す。

**本番に何も載っていないことは実際に確認する。**アセット専用 Worker なら両方とも空になるのが正しい。

```bash
pnpm exec wrangler secret list          # [] であること
pnpm exec wrangler deploy --dry-run | grep -i "binding\|secret\|var"   # No bindings found.
```

（`.env` に API キーを置いているリポジトリでも、アセット専用 Worker では拾われなかった＝実測。とはいえ黙って信用せず毎回確認する）

## Phase 6. 移行後

- リポジトリに残った Vercel 前提の設定と記述を消す（`vercel.json` / README のホスティング節 / `.vercel/` の gitignore 行）
- Vercel のプロジェクト削除（DNS が向いていなければノーリスク）。**GitHub 連携が生きている間は PR に Vercel のプレビューチェックが付き続ける**ので、消すまでは残る
- **Vercel Pro の解約は全プロジェクトの移行が終わってから**
- 落ち着いたら `workers_dev: false`（Preview URL もこれに追従して閉じる）

## 最後に

移行対象が全部終わったら、このスキルごと削除する:

```bash
rm -rf ~/Develop/repositories/src/github.com/dim0627/dotfiles/claude/skills/migrate-to-cloudflare
rm ~/.claude/skills/migrate-to-cloudflare
```
