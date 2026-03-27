# O'Reilly Book Summarizer

O'Reilly の書籍ページ URL を渡すと、ページ内の目次を抽出して「どんな本か」を要約し、さらに章ごとに分けて質問できる Web アプリ + API です。

このプロジェクトは 2 系統の provider を持ちます。

- `Gemini API`: Google OAuth でユーザーを接続し、Bearer token で Gemini API を呼ぶ hosted 向け経路
- `codex` / `claude`: サーバーに入っている公式 CLI を subprocess で呼ぶ runner 経路

トップ画面の `設定` ボタンから、API 連携と CLI 連携をタブで切り替えて設定できます。

## 何ができるか

- O'Reilly URL から書名、著者、目次を抽出
- 抽出した目次を章ごとに整理
- Google OAuth で接続した `Gemini API` で内容要約を生成
- サーバー側の `codex` / `claude` CLI でも内容要約を生成
- 選択した章の目次だけを文脈にしてチャット
- Web UI と HTTP API、CLI の両方を提供
- provider ごとのログイン状態を確認

## 今回の設計判断

ブラウザだけの SPA ではなく、バックエンド付き Web アプリとして実装しています。

- Google OAuth の code exchange はサーバー側で行う
- refresh token をサーバー側セッションで保持する
- O'Reilly の HTML 取得と parser 実行もサーバー側で行う
- `codex` / `claude` はサーバー側 runner として呼ぶ

つまり、`api経由でも` を満たすために HTTP API を持つサーバーアプリになっています。

## 前提

- Node.js 25 以上
- Google OAuth クライアントの作成
- `codex` / `claude` を使う場合はサーバーに CLI を導入
- 必要なら CLI をサーバーでログイン済みにする

## 環境変数

`.env.example` を `.env` にコピーして使う方法も残していますが、MVP では UI の `設定` 画面から保存するのが簡単です。

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GEMINI_MODEL`

CLI も必要なら以下を `.env` または設定 UI で上書きできます。

- `CODEX_COMMAND`
- `CODEX_MODEL`
- `CLAUDE_COMMAND`
- `CLAUDE_MODEL`

## セットアップ

```bash
pnpm install
pnpm dev
```

`pnpm dev` は Next.js の開発サーバーです。ホットリロード付きで起動し、通常は [http://localhost:3000](http://localhost:3000) を開きます。

Google OAuth を使う場合は、Google Cloud Console 側で `GOOGLE_REDIRECT_URI` を承認済み redirect URI に登録してください。

## HTTP API

provider 状態:

```bash
curl http://localhost:3000/api/providers
```

目次抽出:

```bash
curl -X POST http://localhost:3000/api/inspect \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.oreilly.com/library/view/example-book/1234567890/"}'
```

要約:

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.oreilly.com/library/view/example-book/1234567890/","provider":"gemini"}'
```

章チャット:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.oreilly.co.jp/books/9784814401567/","provider":"gemini","chapterId":"chapter-3","messages":[{"role":"user","content":"この章はどんな内容を扱いそう？"}]}'
```

## CLI の使い方

provider 一覧:

```bash
pnpm cli providers
```

URL から目次抽出:

```bash
pnpm cli inspect "https://www.oreilly.com/library/view/example-book/1234567890/"
```

要約:

```bash
pnpm cli summarize "https://www.oreilly.com/library/view/example-book/1234567890/" --provider codex
```

## 構成

- `app/page.tsx`: Next.js のトップページ
- `app/api/*/route.ts`: Next.js API routes
- `app/auth/google/*/route.ts`: Google OAuth 用 route handlers
- `src/components/app-shell.tsx`: クライアント UI
- `src/lib/google-oauth.ts`: Google OAuth code flow
- `src/lib/session.ts`: in-memory session
- `src/cli.ts`: CLI エントリーポイント
- `src/lib/oreilly.ts`: O'Reilly ページの目次抽出
- `src/lib/providers/`: `gemini` / `claude` / `codex` adapter
- `docs/architecture.md`: 設計メモ

## 注意

- `Gemini API` は Google OAuth セッションに依存します
- `claude` / `codex` はサーバー側 CLI のログイン状態に依存します
- `codex` / `claude` を public multi-tenant にそのまま出すなら、ユーザー単位の runner 分離が次の論点です
- O'Reilly 側の DOM 変更には parser の調整が必要です
- `pnpm check` は TypeScript の型検証、`pnpm build` は Next.js のビルド検証です
