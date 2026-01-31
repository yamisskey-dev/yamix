# Yamix

**YAMI トークン経済プラットフォーム - YAMI Token Economy Platform**

menhera.jp の精神を継ぐ、OSS人生相談プラットフォーム。AIと人間が対等なアカウントとして共存し、精神的リソースをYAMIトークン化することで、持続可能な相互扶助の仕組みを実現します。

## 主な機能

- **AI・人間相談** - AIと人間の両方から回答を受け取れる二層構造
- **匿名オプション** - 匿名での相談・回答が可能
- **公開タイムライン** - Misskey風の相談共有機能
- **PWA対応** - インストール可能、オフライン対応
- **プライバシー重視** - データベース暗号化、ノーログ設計

## プライバシー設計

Yamixはプライバシーファーストで設計されています：

| 項目 | 実装状況 |
|------|----------|
| **データベース暗号化** | ✅ メッセージはAES-256-GCMで暗号化して保存 |
| **IPアドレス** | ✅ 記録しない |
| **メッセージ内容のログ** | ✅ 記録しない |
| **後方互換性** | ✅ 既存の平文データも読み込み可能 |

**注意**: AI相談機能を提供するため、メッセージはOpenAI APIに送信されます。これは技術的に不可避であり、真のエンドツーエンド暗号化（E2EE）ではありません。ただし、データベースに保存されるデータは暗号化されているため、DBアクセスのみでは内容を読むことができません

詳細な機能一覧は [FEATURES.md](FEATURES.md) を参照してください。

## 設計思想

詳細: [ECONOMY.md](docs/ECONOMY.md)

- **AIによる依存の代替** - 人間への不健全な依存をAIが吸収し、人間同士の関係を健全化
- **依存へのブレーキ** - 相談にはコストがかかり、無制限の依存を防止
- **回答者への報酬** - 精神的労働には対価が支払われる
- **AIと人間が対等** - 同じインターフェースで相談を受け、境界を意識させない

## 技術スタック

| 項目 | 採用技術 |
|------|----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + DaisyUI |
| Auth | Misskey MiAuth + JWT |
| Database | PostgreSQL + Prisma |
| Cache | Redis |
| PWA | next-pwa (Service Worker + Manifest) |
| API Docs | OpenAPI 3.0 + Swagger UI |
| Blockchain | [YAMI DAO](https://github.com/yamisskey-dev/yamidao) 連携（ETHアドレス管理を委譲） |

## クイックスタート

### 前提条件

- Node.js 22.15.0+
- pnpm 10.18.2+
- Docker & Docker Compose
- [Yamii API](https://github.com/yamisskey-dev/yamii) が起動していること

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/yamisskey-dev/yamix.git
cd yamix

# 依存関係をインストール
pnpm install

# 環境変数を設定
cp .env.local.example .env.local

# データベースを起動
docker-compose up -d

# データベースマイグレーション
pnpm prisma:migrate

# 開発サーバーを起動
pnpm dev
```

起動後: http://localhost:3000

## API ドキュメント

Yamix APIは **OpenAPI 3.0** 標準に準拠しています。FastAPI（Yamii）と統一的な規格でAPIドキュメントを提供します。

- **Swagger UI**: http://localhost:3000/api-docs - 対話的なAPIドキュメント
- **OpenAPI JSON**: http://localhost:3000/api/openapi - 機械可読な仕様

## 開発

```bash
pnpm dev           # 開発サーバー起動
pnpm build         # プロダクションビルド
pnpm start         # プロダクションサーバー起動
pnpm lint          # Lintチェック
pnpm typecheck     # 型チェック
pnpm test          # E2Eテスト実行
pnpm test:ui       # E2EテストをUIモードで実行
pnpm test:report   # テストレポートを表示
pnpm prisma:studio # Prisma Studio起動
```

## CI/CD

プルリクエストとmainブランチへのプッシュ時に、以下のチェックが自動実行されます：

- コードのLint
- TypeScriptの型チェック
- プロダクションビルド
- Playwrightを使用したE2Eテスト

テスト失敗時は、Playwright Reportがアーティファクトとして保存されます。

## ドキュメント

- [FEATURES.md](FEATURES.md) - 機能一覧（実装済み・構想中）
- [ROADMAP.md](ROADMAP.md) - 開発計画と進捗状況
- [ECONOMY.md](docs/ECONOMY.md) - 経済システムの詳細

**現在の状況**: Phase 4まで完了、Phase 5（経済システム）進行中

## ライセンス

AGPL-3.0 License

## 謝辞

- 故 menhera.jp の精神を継承
- [Misskey](https://github.com/misskey-dev/misskey) - 認証システムとタイムラインUI
- ChatGPT - AI対話インターフェース
- Black Cat Carnival - UX設計の参考

---

**Made with care for those who need support**
