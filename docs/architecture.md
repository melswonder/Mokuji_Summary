# 設計メモ

## 目的

特定の Web サイトの URL が渡されたら、その本の目次から「どのような内容の本か」を要約する。

最初の対象サイトは O'Reilly。

## MVP の前提

### 1. O'Reilly の HTML から目次を抽出する

MVP では API 連携ではなく、公開ページ HTML を取得して以下の順で目次候補を探す。

- JSON-LD の `Book` メタデータ
- `Table of Contents` / `Contents` 付近の見出しとリスト
- `toc`, `contents`, `chapter` などを含むクラス名・ID
- `Chapter`, `Part`, `Appendix` などの章立てらしい行

### 2. 要約は provider adapter に隠蔽する

provider 共通インターフェース:

- `getStatus()`: CLI が存在するか、ログイン済みか
- `summarize(book)`: 抽出済みの目次情報から要約を返す

最初の provider:

- `gemini`: Google OAuth + Gemini API
- `codex`: `codex exec`
- `claude`: `claude -p`

### 3. Web アプリ化に伴い、OAuth はアプリ側と CLI 側に分ける

今回の重要な設計判断はここ。

- `gemini` はアプリ側で Google OAuth code flow を持つ
- `codex` と `claude` は公式 CLI 自身のログイン機構を使う
- アプリは OpenAI / Anthropic の API key を前提にしない
- アプリは provider ごとに認証方式を切り替える

このため MVP は「バックエンド付き Web アプリ」として実装する。

## hosted 向けと runner 向けの境界

`gemini` は hosted 向けに素直。

- ユーザーごとに Google OAuth で接続できる
- アプリの HTTP API から Gemini API を直接呼べる

一方で `codex` / `claude` は runner 前提。

- CLI ベースの認証状態は通常その端末や runner に保存される
- サーバー上の 1 つのログイン状態を複数ユーザーで共有すると危険
- public multi-tenant 化するならユーザー単位の runner 分離が必要

したがって MVP では、`codex` / `claude` は「運用者が管理する server-side runner」と位置付ける。

## 実装方針

### サーバー

Node.js + TypeScript + Next.js App Router

API:

- `GET /api/session`: セッションと Google 連携状態
- `GET /api/providers`: provider 状態確認
- `GET /auth/google/start`: Google OAuth 開始
- `GET /auth/google/callback`: Google OAuth callback
- `POST /api/auth/google/disconnect`: Google 連携解除
- `POST /api/inspect`: URL から書誌情報と目次を抽出
- `POST /api/summarize`: 抽出結果を provider に送って要約

### CLI

同じドメインロジックを使う薄いラッパー。

- `providers`
- `inspect <url>`
- `summarize <url> --provider codex|claude`

### UI

最小のローカル Web UI を付ける。開発中は `next dev` のホットリロードを使う。

- Google 接続状態
- provider 選択
- provider 状態表示
- URL 入力
- 抽出した目次の確認
- 生成された要約の確認

## 次の拡張

- O'Reilly 以外のドメイン対応
- 抽出結果のキャッシュ
- 目次の品質スコアリング
- provider ごとのプロンプト最適化
- CLI provider の user-isolated runner 化
