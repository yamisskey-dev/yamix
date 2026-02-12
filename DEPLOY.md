# 本番環境デプロイ手順

## 1. コミット

```bash
git add .
git commit -m "security: GAFA級セキュリティ強化 (V2暗号化/監査ログ/CSRF/レート制限)"
git push origin main
```

## 2. 本番環境でビルド

```bash
ssh caspar
cd /var/www/yamix
git pull origin main

# Dockerイメージビルド
docker compose build

# コンテナ再起動
docker compose down
docker compose up -d
```

## 3. マイグレーション実行

```bash
# Prismaマイグレーション（監査ログテーブル追加）
docker compose exec app prisma migrate deploy
```

## 4. V1→V2 メッセージ再暗号化

```bash
# ドライラン（確認）
docker compose exec app npx tsx scripts/migrate-encryption-v1-to-v2.ts --dry-run

# 本番実行
docker compose exec app npx tsx scripts/migrate-encryption-v1-to-v2.ts --batch-size=100
```

## 5. 動作確認

```bash
# ログ確認
docker compose logs -f app

# ヘルスチェック
curl -I https://mix.yami.ski/api/health

# ブラウザで確認
# - https://mix.yami.ski にアクセス
# - 既存メッセージ表示確認
# - 新規メッセージ作成テスト
```

## 6. V1コード削除（オプション）

V2再暗号化が完了し、全メッセージが正常に表示されることを確認したら：

`src/lib/encryption.ts` から以下を削除：
- `ENCRYPTED_PREFIX_V1` 定数
- `deriveUserKeyV1()` 関数
- `decryptMessage()` 内のV1分岐

```bash
git commit -m "chore: Remove V1 encryption support"
git push origin main
docker compose build && docker compose up -d
```

## トラブルシューティング

### ロールバック
```bash
docker compose down
git reset --hard HEAD~1
docker compose build && docker compose up -d
```

### ログ確認
```bash
docker compose logs app --tail=100 -f
```
