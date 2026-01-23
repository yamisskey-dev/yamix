-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'GAS_TIP';

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "gasAmount" INTEGER NOT NULL DEFAULT 0;
