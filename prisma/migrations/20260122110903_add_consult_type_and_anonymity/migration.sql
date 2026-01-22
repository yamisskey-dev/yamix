/*
  Warnings:

  - You are about to drop the `follows` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ConsultType" AS ENUM ('PRIVATE', 'PUBLIC');

-- DropForeignKey
ALTER TABLE "follows" DROP CONSTRAINT "follows_followerId_fkey";

-- DropIndex
DROP INDEX "chat_sessions_isPublic_createdAt_idx";

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "category" TEXT,
ADD COLUMN     "consultType" "ConsultType" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "follows";

-- CreateIndex
CREATE INDEX "chat_sessions_consultType_createdAt_idx" ON "chat_sessions"("consultType", "createdAt");

-- CreateIndex
CREATE INDEX "chat_sessions_category_idx" ON "chat_sessions"("category");
