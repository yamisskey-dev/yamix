-- AlterTable
ALTER TABLE "users" ADD COLUMN     "encryptedMasterKey" TEXT,
ADD COLUMN     "masterKeyIv" TEXT,
ADD COLUMN     "masterKeySalt" TEXT;
