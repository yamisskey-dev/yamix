-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('HUMAN', 'AI_SYSTEM', 'AI_AGENT', 'DAO');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('CONSULTATION', 'RESPONSE', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "ConsultTarget" AS ENUM ('AI', 'HUMAN', 'ANY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CONSULT_AI', 'CONSULT_HUMAN', 'RESPONSE_REWARD', 'DAILY_GRANT', 'DECAY', 'REACTION', 'SYSTEM_GRANT', 'PURCHASE', 'WITHDRAWAL', 'DAO_DIVIDEND');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "instances" TEXT NOT NULL,
    "instanceType" TEXT NOT NULL,
    "appSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ethAddress" TEXT,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 10,
    "walletType" "WalletType" NOT NULL DEFAULT 'HUMAN',
    "lastDailyGrantAt" TIMESTAMP(3),
    "lastDecayAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "daoAddress" TEXT,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "parentId" TEXT,
    "postType" "PostType" NOT NULL DEFAULT 'CONSULTATION',
    "targetType" "ConsultTarget",
    "tokenCost" INTEGER NOT NULL DEFAULT 0,
    "tokenReward" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "senderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "txType" "TransactionType" NOT NULL DEFAULT 'REACTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_purchases" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ethAmount" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "token_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_withdrawals" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ethAmount" TEXT NOT NULL,
    "ethAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "token_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByDaoProposal" TEXT,

    CONSTRAINT "economy_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL,
    "isCrisis" BOOLEAN NOT NULL DEFAULT false,
    "responderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servers_instances_key" ON "servers"("instances");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "users_ethAddress_key" ON "users"("ethAddress");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_daoAddress_key" ON "wallets"("daoAddress");

-- CreateIndex
CREATE INDEX "wallets_walletType_idx" ON "wallets"("walletType");

-- CreateIndex
CREATE INDEX "follows_followerId_idx" ON "follows"("followerId");

-- CreateIndex
CREATE INDEX "follows_targetId_idx" ON "follows"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_targetId_key" ON "follows"("followerId", "targetId");

-- CreateIndex
CREATE INDEX "posts_walletId_idx" ON "posts"("walletId");

-- CreateIndex
CREATE INDEX "posts_parentId_idx" ON "posts"("parentId");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");

-- CreateIndex
CREATE INDEX "posts_postType_idx" ON "posts"("postType");

-- CreateIndex
CREATE INDEX "transactions_postId_idx" ON "transactions"("postId");

-- CreateIndex
CREATE INDEX "transactions_senderId_idx" ON "transactions"("senderId");

-- CreateIndex
CREATE INDEX "transactions_txType_idx" ON "transactions"("txType");

-- CreateIndex
CREATE INDEX "token_purchases_walletId_idx" ON "token_purchases"("walletId");

-- CreateIndex
CREATE INDEX "token_purchases_status_idx" ON "token_purchases"("status");

-- CreateIndex
CREATE INDEX "token_withdrawals_walletId_idx" ON "token_withdrawals"("walletId");

-- CreateIndex
CREATE INDEX "token_withdrawals_status_idx" ON "token_withdrawals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "economy_config_key_key" ON "economy_config"("key");

-- CreateIndex
CREATE INDEX "chat_sessions_userId_updatedAt_idx" ON "chat_sessions"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "chat_sessions_isPublic_createdAt_idx" ON "chat_sessions"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_responderId_idx" ON "chat_messages"("responderId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_withdrawals" ADD CONSTRAINT "token_withdrawals_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
