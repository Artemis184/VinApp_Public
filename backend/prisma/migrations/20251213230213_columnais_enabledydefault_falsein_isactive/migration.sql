-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "is_enabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "is_active" SET DEFAULT false;
