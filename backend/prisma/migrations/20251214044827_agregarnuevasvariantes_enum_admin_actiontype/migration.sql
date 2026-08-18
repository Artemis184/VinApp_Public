/*
  Warnings:

  - The values [CREATE_ADMIN,REMOVE_ADMIN] on the enum `admin_action_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "admin_action_type_new" AS ENUM ('APPROVE_USER', 'REJECT_USER', 'SUSPEND_USER', 'ASSIGN_NODE', 'REVOKE_NODE', 'UPDATE_USER_DATA', 'ENABLE_USER', 'UPDATE_NODE_DATA', 'SUSPEND_NODE', 'ENABLE_NODE');
ALTER TABLE "audit_admin_actions" ALTER COLUMN "action_type" TYPE "admin_action_type_new" USING ("action_type"::text::"admin_action_type_new");
ALTER TYPE "admin_action_type" RENAME TO "admin_action_type_old";
ALTER TYPE "admin_action_type_new" RENAME TO "admin_action_type";
DROP TYPE "admin_action_type_old";
COMMIT;

-- AlterEnum
ALTER TYPE "user_action_type" ADD VALUE 'UPDATE_USER_DATA';
