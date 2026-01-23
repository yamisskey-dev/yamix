# Yamix

**YAMI トークン経済プラットフォーム - YAMI Token Economy Platform**

menhera.jp の精神を継ぐ、OSS人生相談プラットフォーム。AIと人間が対等なアカウントとして共存し、精神的リソースをYAMIトークン化することで、持続可能な相互扶助の仕組みを実現します。

## 実装済み機能

### 認証・アカウント
- **Misskeyログイン** - MiAuthによるセキュアな認証
- **1:1 ウォレット** - Misskeyアカウントと1対1でウォレット管理

### 相談機能
- **AI相談** - Yamii APIを通じた人生相談
- **人間相談** - 他ユーザーからの回答を受け取れる
- **匿名回答オプション** - 相談者が匿名回答を許可可能
- **感情分析** - AIがあなたの感情を理解
- **危機検出** - つらいときには相談窓口を案内

### ソーシャル機能
- **公開タイムライン** - 相談を公開して他ユーザーと共有
- **リプライツリー** - Misskey/X風の回答スレッド表示
- **通知システム** - 回答・メンション・ガス受信の通知（アプリ内のみ）
- **ブックマーク** - 気になる相談をブックマーク保存
- **ユーザーブロック** - 特定ユーザーからの回答をブロック

### UI/UX
- **テーマ切り替え** - ダーク/ライト + システム連動
- **レスポンシブデザイン** - モバイル・デスクトップ対応
- **PWA対応** - インストール可能、オフラインキャッシュ対応

## 構想中の機能

### 経済システム（Phase 5）
- **Optimismウォレット連携** - ブロックチェーンウォレット接続
- **YAMI購入/換金** - Optimism ETHとの交換機能
- **毎日の無料YAMI付与** - 持続可能な経済設計

### 将来的な拡張（Phase 6）
- **YAMI DAOガバナンス** - 経済パラメータの民主的調整
- **多言語対応** - 英語・韓国語サポート
- **プッシュ通知** - ※依存を深める可能性があるため慎重に検討中

## 設計思想

詳細: [YAMI トークン経済設計](docs/YAMI_ECONOMY.md)

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
| Blockchain | Optimism（構想中） |

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

## API構成

```
/api/
├── auth/                  # 認証
│   ├── misskey-login/    # MiAuthセッション開始
│   ├── callback/         # コールバック処理
│   ├── refresh/          # トークンリフレッシュ
│   └── logout/           # ログアウト
├── wallets/              # ウォレット管理
│   └── [id]/
│       ├── balance/      # 残高取得
│       └── ...
├── sessions/             # 相談セッション
│   └── [id]/
│       ├── messages/     # メッセージ一覧
│       ├── public/       # 公開設定
│       └── ...
├── messages/             # メッセージ・回答
│   └── [id]/
│       ├── gas/          # ガスを送る
│       └── ...
├── users/                # ユーザー管理
│   ├── block/            # ブロックリスト
│   └── block/[id]/       # ブロック・解除
├── follows/              # フォロー
│   └── [walletId]/
│       └── timeline/     # ホームタイムライン
├── bookmarks/            # ブックマーク
├── notifications/        # 通知
├── transactions/         # 取引履歴
└── yamii/                # AI相談プロキシ
    ├── chat/             # AI相談
    └── user/             # プロフィール管理
```

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

## ロードマップ

### Phase 1: 基盤 ✅
- [x] 基本認証（Misskey MiAuth）
- [x] 1:1 ユーザー・ウォレットシステム
- [x] AIチャット相談機能（Yamii API連携）
- [x] フォロー・タイムライン

### Phase 2: ソーシャル機能 ✅
- [x] 相談の公開/非公開切り替え
- [x] 公開タイムライン（Misskey風UI）
- [x] 人間による回答機能
- [x] 匿名回答オプション
- [x] リプライツリー表示
- [x] ユーザープロフィールページ
- [x] セッション検索
- [x] 通知システム（アプリ内）
- [x] ブックマーク機能
- [x] ユーザーブロック機能

### Phase 3: UI/UX ✅
- [x] テーマ切り替え（DXM/NGO + システム連動）
- [x] NeoQuesdon風ローディングアニメーション
- [x] Misskey風ノートデザイン
- [x] レスポンシブ対応
- [x] 回答ポップアップUI（LINE風）
- [x] PWA対応（インストール可能、オフラインキャッシュ）

### Phase 4: セキュリティ ✅
- [x] JWT認証（HttpOnly Cookie）
- [x] 全APIエンドポイント認証・認可チェック
- [x] 非公開データの漏洩防止
- [x] セッション存在確認攻撃対策

### Phase 5: 経済システム 🚧
- [x] YAMI経済基盤（AI/人間コスト差別化）
- [ ] Optimismウォレット連携
- [ ] YAMI購入/換金UI（Optimism ETH）
- [ ] 毎日の無料YAMI付与

### Phase 6: 将来 📋
- [ ] YAMI DAOガバナンス統合
- [ ] 多言語対応（英語・韓国語）
- [ ] プッシュ通知（※依存を深める可能性があるため慎重に検討中）

## 関連プロジェクト

- [Yamii](https://github.com/yamisskey-dev/yamii) - AI相談APIサーバー
- [YAMI DAO](https://github.com/yamisskey-dev/yamidao) - ガバナンスプラットフォーム
- [Neo-Quesdon](https://github.com/yamisskey-dev/neo-quesdon) - Q&Aプラットフォーム

## ライセンス

AGPL-3.0 License

## 謝辞

- 故 menhera.jp にインスパイア
- [Misskey](https://github.com/misskey-dev/misskey) と同じ精神で

---

**Made with care for those who need support**
