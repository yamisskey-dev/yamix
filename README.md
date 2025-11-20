# Yamix

**承認経済による匿名相談プラットフォーム - Anonymous consultation platform with approval economy**

ブロックチェーンにインスパイアされた匿名アイデンティティシステム。ユーザーは複数の「人格」を作成し、相談と反応を通じて承認トークンを獲得します。

## 思想

Yamixは従来のSNSとは異なる用語体系を持ちます：

| 概念 | 一般的なSNS | Yamix |
|------|------------|-------|
| ユーザー | アカウント | **人格** (Persona) |
| 投稿 | ポスト | **相談** (Consultation) |
| 返信 | リプライ | **反応** (Reaction) |
| フォロー | フォロー | **注目** (Attention) |
| いいね | いいね | **承認** (Approval) |

### 人格 (Persona)

- Ethereumスタイルのアドレス（`0x` + 40文字の16進数）
- 従来の認証なし - 人格はブラウザに保存
- 1ユーザーが複数の人格を持てる（最大10）
- 任意で表示名を設定可能

### 承認経済

- **初期残高**: 10承認
- **相談コスト**: 1承認（自分の相談への反応は無料）
- **反応報酬**: 1承認（相談者が受け取る）
- **最大残高**: 100承認

相談を投稿するには承認が必要です。反応を受けると承認が増え、より多くの相談ができるようになります。

### 注目（サイレントウォッチ）

- 注目された側には通知されない
- タイムラインに注目した人格の相談が表示される
- プライバシーを重視した設計

## 機能

- 🎭 **匿名人格システム** - 複数の匿名アイデンティティを作成
- 💬 **相談と反応** - 悩みを相談し、反応をもらう
- 💰 **承認経済** - トークンによるインセンティブ設計
- 👁️ **サイレント注目** - 相手に知られずにフォロー
- 📱 **レスポンシブデザイン** - モバイル対応
- 🚀 **モダン技術スタック** - Vue 3, Fastify, Prisma, PostgreSQL

## 技術スタック

### フロントエンド
- **Vue 3** with Composition API
- **Vite** for blazing fast builds
- **Pinia** for state management
- **TypeScript** for type safety

### バックエンド
- **Fastify** - High-performance Node.js framework
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Primary database
- **Zod** - Schema validation
- **OpenAPI** - Auto-generated API documentation

## プロジェクト構成

```
yamix/
├── packages/
│   ├── frontend/       # Vue 3 application
│   ├── backend/        # Fastify API server
│   └── shared/         # Shared types and schemas
├── docker-compose.yml  # PostgreSQL
└── pnpm-workspace.yaml # Monorepo configuration
```

## クイックスタート

### 前提条件

- Node.js 22.15.0 or higher
- pnpm 10.18.2 or higher
- Docker & Docker Compose

### インストール

1. **リポジトリをクローン**
   ```bash
   git clone https://github.com/yamisskey-dev/yamix.git
   cd yamix
   ```

2. **依存関係をインストール**
   ```bash
   pnpm install
   ```

3. **データベースを起動**
   ```bash
   docker-compose up -d
   ```

4. **バックエンド環境を設定**
   ```bash
   cd packages/backend
   cp .env.example .env
   ```

5. **データベースマイグレーションを実行**
   ```bash
   cd packages/backend
   pnpm prisma:migrate
   ```

6. **開発サーバーを起動**
   ```bash
   # プロジェクトルートから
   pnpm dev
   ```

   起動されるサービス:
   - フロントエンド: http://localhost:5173
   - バックエンドAPI: http://localhost:3000
   - APIドキュメント: http://localhost:3000/docs

## API

### 人格 (Wallets)

```bash
# 人格を作成
POST /api/wallets
{
  "name": "表示名（任意）"
}

# 人格を取得
GET /api/wallets/:address

# 人格名を更新
PATCH /api/wallets/:address
{
  "name": "新しい名前"
}

# 人格の相談一覧を取得
GET /api/wallets/:address/posts

# 人格を削除
DELETE /api/wallets/:address
```

### 相談 (Posts)

```bash
# 相談一覧を取得（ページネーション付き）
GET /api/posts?page=1&limit=20

# 相談を取得（反応含む）
GET /api/posts/:id

# 相談を作成
POST /api/posts
{
  "content": "相談内容",
  "walletId": "wallet-uuid"
}

# 反応を作成（相談への返信）
POST /api/posts
{
  "content": "反応内容",
  "walletId": "wallet-uuid",
  "parentId": "parent-post-uuid"
}

# 相談を削除（所有者のみ）
DELETE /api/posts/:id
{
  "walletId": "wallet-uuid"
}
```

### 注目 (Follows)

```bash
# 注目する
POST /api/follows
{
  "followerId": "wallet-uuid",
  "targetAddress": "0x..."
}

# 注目を解除
DELETE /api/follows
{
  "followerId": "wallet-uuid",
  "targetAddress": "0x..."
}

# 注目一覧を取得
GET /api/follows/:walletId

# 注目状態を確認
GET /api/follows/:walletId/check/:targetAddress

# タイムラインを取得
GET /api/follows/:walletId/timeline?page=1&limit=20
```

### 承認 (Transactions)

```bash
# 承認を送る
POST /api/transactions
{
  "postId": "post-uuid",
  "senderId": "wallet-uuid",
  "amount": 1
}
```

## 開発

### スクリプト

```bash
# 依存関係をインストール
pnpm install

# 開発サーバーを起動
pnpm dev

# ビルド
pnpm build

# 型チェック
pnpm typecheck

# テスト
pnpm test

# リント
pnpm lint
```

### バックエンドスクリプト

```bash
cd packages/backend

# Prismaクライアント生成
pnpm prisma:generate

# マイグレーション実行
pnpm prisma:migrate

# Prisma Studio起動
pnpm prisma:studio
```

## 設定

### 環境変数

**Backend (.env)**
```env
DATABASE_URL="postgresql://yamix:password@localhost:5432/yamix"
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

AGPL-3.0 License

## 謝辞

- 故 menhera.jp にインスパイア
- [Misskey](https://github.com/misskey-dev/misskey) と同じ精神で

---

**Made with ❤️ for those who need support**
