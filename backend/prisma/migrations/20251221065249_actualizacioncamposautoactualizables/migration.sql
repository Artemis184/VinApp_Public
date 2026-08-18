-- AlterTable
ALTER TABLE "access" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "menus" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nodes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;
