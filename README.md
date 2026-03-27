# Mokuji Summary

本の URL から目次を抽出し、章ごとに独立したスレッドで AI と会話できるワークスペースです。

現在の構成は `frontend/` `backend/` `infra/` の分離構成です。

## Directory Layout

- `frontend/`: Next.js App Router + Tailwind CSS + Lucide React
- `backend/`: FastAPI + SQLAlchemy + Postgres 向け API
- `infra/`: Docker Compose
- `fixtures/`: 既存抽出ロジックの fixture

## Features

- URL から書籍ページを解析し、目次を抽出
- 左サイドバーで `Overview` と各章を切り替え
- `章 × provider` ごとに履歴を分離したスレッドチャット
- Gemini / Codex / Claude の provider 状態表示
- Google OAuth 接続導線
- 本全体 summary の provider 別保存

## Supported Sources

v1 の正式対応ドメイン:

- `oreilly.com`
- `oreilly.co.jp`
- `shoeisha.co.jp`
- `gihyo.jp`

未対応 URL は backend が 400 を返します。

## Environment Variables

ルートの `.env.example` を `.env` にコピーして使います。

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GEMINI_MODEL`
- `CODEX_COMMAND`
- `CODEX_MODEL`
- `CLAUDE_COMMAND`
- `CLAUDE_MODEL`

## Local Development

Docker Compose ベース:

```bash
make up
```

主なターゲット:

- `make up`
- `make down`
- `make logs`
- `make migrate`
- `make test`
- `make smoke`

フロントエンドだけローカルで確認する場合:

```bash
cd frontend
npm install
npm run build
```

バックエンドをローカル単体で起動する場合、既定では `sqlite:///backend/data/mokuji.db` を使います。
Docker Compose 経由では `infra/compose.yml` 側の `DATABASE_URL` で Postgres を使います。

## API Surface

- `POST /api/v1/books/inspect`
- `GET /api/v1/books/{bookId}`
- `GET /api/v1/books/{bookId}/threads`
- `POST /api/v1/books/{bookId}/threads/messages`
- `POST /api/v1/books/{bookId}/summary`
- `GET /api/v1/providers`
- `GET /api/v1/session`
- `GET/PUT /api/v1/settings`
- `GET /api/v1/auth/google/start`
- `GET /api/v1/auth/google/callback`

## Notes

- backend の DB 初期化は `backend/app/migrate.py` と startup 時の `create_all` を使っています。
- Gemini OAuth や CLI provider の動作確認には実際の認証情報が必要です。
- この環境では Docker build が bridge 制約で失敗したため、frontend はローカル build で確認しています。
