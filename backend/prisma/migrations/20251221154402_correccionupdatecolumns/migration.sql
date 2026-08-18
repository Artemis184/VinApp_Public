-- AlterTable
ALTER TABLE "access" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "menus" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "nodes" ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP NOT NULL;
