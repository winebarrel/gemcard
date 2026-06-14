# gemcard

[![Deploy](https://github.com/winebarrel/gemcard/actions/workflows/deploy.yml/badge.svg)](https://github.com/winebarrel/gemcard/actions/workflows/deploy.yml)
[![CI](https://github.com/winebarrel/gemcard/actions/workflows/ci.yml/badge.svg)](https://github.com/winebarrel/gemcard/actions/workflows/ci.yml)

RubyGems の gem URL を X (Twitter) / Slack の OGP カードに対応した URL に変換する Cloudflare Workers アプリ。

## 仕組み

- `https://gemcard.winebarrel.workers.dev/gems/<name>` にアクセスすると、RubyGems の JSON API から gem 名 / version / 概要 / DL 数 / オーナーを取得し、`og:*` と `twitter:card` メタタグを埋めた HTML を返す。これを X / Slack に貼るとカード表示される。
- `og:image` は `/img/<name>.png` で動的生成。gem 名・version・概要・DL 数・オーナーアバターを並べた 1200x630 PNG を [workers-og](https://github.com/kvnang/workers-og) (Satori + resvg) で生成する。
- ルートページ (`/`) は gem 名または RubyGems URL を入力するとプロキシ URL を返し、X カード風のプレビューを表示する。

## 開発

```bash
npm ci
npm run lint        # Biome (lint + format check)
npm run typecheck   # tsc --noEmit
npm run build       # wrangler deploy --dry-run
npm run format      # Biome auto-fix
```

## ローカルで動かす

```bash
npm run dev
```

`http://localhost:8787/` でトップページ、`http://localhost:8787/gems/rails` 等で OGP HTML、`http://localhost:8787/img/rails.png` でカード画像を確認できる。

## デプロイ

main への push で GitHub Actions が `wrangler deploy` を実行する (`src/` や `wrangler.jsonc`, 依存ファイルが変更された場合のみ)。
