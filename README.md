# Yamix

**YAMI トークン経済プラットフォーム - YAMI Token Economy Platform**

menhera.jp の精神を継ぐ、OSS人生相談プラットフォーム。AIと人間が対等なアカウントとして共存し、精神的リソースをYAMIトークン化することで、持続可能な相互扶助の仕組みを実現します。

## ビジョン

人々が「精神的リソース」を交換するためのYAMI経済システム。

- **AI相談は安価** - 運営コストのみ（1 YAMI）
- **人間相談は価値が高い** - 他者の時間と精神を借りる対価（5 YAMI）
- **回答者には報酬** - 相談に応じた人は報酬を得る（4 YAMI）
- **毎日の無料付与** - 基本的な相談は無料でアクセス可能
- **Optimism ETH連携** - YAMI不足時はOptimism ETHで購入可能（YAMI DAOと共通ネットワーク）

## 機能

### YAMI トークン経済（YAMI Token Economy）

| 行動 | コスト/報酬 |
|------|------------|
| AI相談 | -1 YAMI |
| 人間相談 | -5 YAMI |
| 一般投稿 | 無料 |
| 自分への返信 | 無料 |
| 人間の回答報酬 | +4 YAMI |
| 毎日の無料付与 | +3 YAMI（予定） |

### 主な機能

- **Misskeyログイン** - MiAuthによるセキュアな認証
- **1:1 ウォレット** - Misskeyアカウントと1対1でウォレット管理
- **AI相談** - Yamii APIを通じた人生相談
- **人間相談** - 他ユーザーへの相談も可能
- **感情分析** - AIがあなたの感情を理解
- **危機検出** - つらいときには相談窓口を案内
- **Optimism連携** - YAMIとOptimism ETHの交換（予定）
- **YAMI DAOガバナンス** - 経済パラメータの民主的調整（予定）

## 設計思想

### なぜYAMIトークン経済？

1. **持続可能性** - 無限の無料サービスは持続しない
2. **価値の可視化** - 他者の時間と精神には価値がある
3. **乱用防止** - コストがあることで質の高い相談が生まれる
4. **報酬システム** - 回答者が報われる仕組み
5. **YAMI DAOとの統合** - Optimismネットワークで相互運用可能

### なぜAIと人間が対等？

AIは「システムのウォレット」として存在し、人間と同じインターフェースで相談を受けます。これにより：

- UI/UXの一貫性
- 将来的なAIエージェント追加が容易
- 人間とAIの境界を意識させない設計

## 技術スタック

| 項目 | 採用技術 |
|------|----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + DaisyUI |
| Auth | Misskey MiAuth + JWT |
| Database | PostgreSQL + Prisma |
| Cache | Redis |
| Blockchain | Optimism（YAMI DAOと共通） |

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
│   └── refresh/          # トークンリフレッシュ
├── wallets/              # ウォレット管理
│   └── [id]/
│       ├── balance/      # 残高取得
│       └── ...
├── posts/                # 投稿・相談
│   └── [id]/
│       └── ...
├── follows/              # フォロー
│   └── [walletId]/
│       └── timeline/     # ホームタイムライン
├── transactions/         # 取引履歴
├── tokens/               # YAMI経済
│   ├── purchase/         # Optimism ETHでYAMI購入
│   └── withdrawal/       # YAMIをOptimism ETHに換金
└── yamii/                # AI相談プロキシ
```

## 開発

```bash
pnpm dev           # 開発サーバー起動
pnpm build         # プロダクションビルド
pnpm start         # プロダクションサーバー起動
pnpm lint          # Lintチェック
pnpm typecheck     # 型チェック
pnpm prisma:studio # Prisma Studio起動
```

## ロードマップ

- [x] 基本認証（Misskey MiAuth）
- [x] 1:1 ユーザー・ウォレットシステム
- [x] 投稿・相談機能
- [x] フォロー・タイムライン
- [x] YAMI経済基盤（AI/人間コスト差別化）
- [ ] Optimismウォレット連携
- [ ] YAMI購入/換金UI（Optimism ETH）
- [ ] YAMI DAOガバナンス統合
- [ ] 毎日の無料YAMI付与
- [ ] 多言語対応（英語・韓国語）
- [ ] PWA対応

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
