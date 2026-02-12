#!/bin/bash

###############################################################################
# セキュリティ監査スクリプト
# 用途: 依存関係の脆弱性チェックとセキュリティ設定確認
###############################################################################

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  YAMIXセキュリティ監査${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ISSUES_FOUND=0

# 1. npm audit
echo -e "${YELLOW}[1/6] npm audit実行中...${NC}"
if npm audit --production; then
    echo -e "${GREEN}✓ 本番依存関係に既知の脆弱性はありません${NC}"
else
    echo -e "${RED}✗ 脆弱性が見つかりました${NC}"
    echo -e "${YELLOW}修正を試みます...${NC}"
    npm audit fix --production
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 2. 環境変数チェック
echo -e "${YELLOW}[2/6] 環境変数チェック...${NC}"
REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "MESSAGE_ENCRYPTION_KEY"
    "NODE_ENV"
)

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env 2>/dev/null; then
        echo -e "${GREEN}✓ ${var} 設定済み${NC}"
    else
        echo -e "${RED}✗ ${var} が設定されていません${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done
echo ""

# 3. ファイルパーミッションチェック
echo -e "${YELLOW}[3/6] ファイルパーミッションチェック...${NC}"
SENSITIVE_FILES=(
    ".env"
    ".env.local"
)

for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
        if [ "$perms" == "600" ] || [ "$perms" == "400" ]; then
            echo -e "${GREEN}✓ ${file} パーミッションOK (${perms})${NC}"
        else
            echo -e "${YELLOW}⚠ ${file} パーミッションを600に変更することを推奨 (現在: ${perms})${NC}"
            echo -e "  実行: ${BLUE}chmod 600 ${file}${NC}"
        fi
    fi
done
echo ""

# 4. Gitignoreチェック
echo -e "${YELLOW}[4/6] .gitignoreチェック...${NC}"
SHOULD_BE_IGNORED=(
    ".env"
    ".env.local"
    ".env.production"
    "node_modules"
)

for item in "${SHOULD_BE_IGNORED[@]}"; do
    if grep -q "^${item}" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓ ${item} は.gitignoreに含まれています${NC}"
    else
        echo -e "${RED}✗ ${item} が.gitignoreに含まれていません${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done
echo ""

# 5. セキュリティヘッダーチェック（ローカルサーバーが起動している場合）
echo -e "${YELLOW}[5/6] セキュリティヘッダーチェック (オプション)...${NC}"
if command -v curl &> /dev/null; then
    if curl -s -I http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${BLUE}ローカルサーバーが起動しています。ヘッダーをチェック中...${NC}"

        HEADERS=(
            "X-Frame-Options"
            "X-Content-Type-Options"
            "Strict-Transport-Security"
            "Content-Security-Policy"
        )

        for header in "${HEADERS[@]}"; do
            if curl -s -I http://localhost:3000 | grep -qi "^${header}:"; then
                echo -e "${GREEN}✓ ${header} ヘッダーが設定されています${NC}"
            else
                echo -e "${YELLOW}⚠ ${header} ヘッダーが見つかりません${NC}"
            fi
        done
    else
        echo -e "${YELLOW}⚠ ローカルサーバーが起動していません。スキップします。${NC}"
    fi
else
    echo -e "${YELLOW}⚠ curlがインストールされていません。スキップします。${NC}"
fi
echo ""

# 6. Prismaスキーマチェック
echo -e "${YELLOW}[6/6] Prismaスキーマチェック...${NC}"
if [ -f "prisma/schema.prisma" ]; then
    if grep -q "model AuditLog" prisma/schema.prisma; then
        echo -e "${GREEN}✓ 監査ログモデルが存在します${NC}"
    else
        echo -e "${RED}✗ 監査ログモデルが見つかりません${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${RED}✗ prisma/schema.prismaが見つかりません${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# サマリー
echo -e "${BLUE}========================================${NC}"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ セキュリティ監査完了: 問題なし${NC}"
    echo -e "${GREEN}セキュリティスコア: 10/10${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  セキュリティ監査完了: ${ISSUES_FOUND}件の問題が見つかりました${NC}"
    echo -e "${YELLOW}上記の問題を修正してください。${NC}"
    exit 1
fi
