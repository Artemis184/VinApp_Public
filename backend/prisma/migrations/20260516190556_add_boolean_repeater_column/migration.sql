-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "admin_action_type" ADD VALUE 'SEND_NOTIFICATION';
ALTER TYPE "admin_action_type" ADD VALUE 'PASSWORD_RESET_REQUEST';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "user_action_type" ADD VALUE 'PASSWORD_CHANGED';
ALTER TYPE "user_action_type" ADD VALUE 'NOTIFICATION_RECEIVED';

-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "uses_repeater" BOOLEAN NOT NULL DEFAULT false;
