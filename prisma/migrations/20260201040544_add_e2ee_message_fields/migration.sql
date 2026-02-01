-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "encryptedIv" TEXT,
ADD COLUMN     "isE2EE" BOOLEAN NOT NULL DEFAULT false;
