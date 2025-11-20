-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "posts_parent_id_idx" ON "posts"("parent_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
