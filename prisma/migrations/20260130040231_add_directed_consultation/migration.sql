-- AlterEnum
ALTER TYPE "ConsultType" ADD VALUE 'DIRECTED';

-- CreateTable
CREATE TABLE "chat_session_targets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_session_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_session_targets_userId_idx" ON "chat_session_targets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_session_targets_sessionId_userId_key" ON "chat_session_targets"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "chat_session_targets" ADD CONSTRAINT "chat_session_targets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_session_targets" ADD CONSTRAINT "chat_session_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
