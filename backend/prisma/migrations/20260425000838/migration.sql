-- AlterTable
ALTER TABLE "audit_admin_actions" ADD COLUMN     "ip_address" VARCHAR(45);

-- AlterTable
ALTER TABLE "audit_user_actions" ADD COLUMN     "ip_address" VARCHAR(45);

-- CreateIndex
CREATE INDEX "idx_admin_audit_timestamp" ON "audit_admin_actions"("action_timestamp");

-- CreateIndex
CREATE INDEX "idx_user_audit_timestamp" ON "audit_user_actions"("action_timestamp");
