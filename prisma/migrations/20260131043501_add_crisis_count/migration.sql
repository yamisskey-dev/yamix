-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "crisisCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "profiles" ALTER COLUMN "allowDirectedConsult" SET DEFAULT false;
