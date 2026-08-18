-- CreateEnum
CREATE TYPE "admin_action_type" AS ENUM ('APPROVE_USER', 'REJECT_USER', 'SUSPEND_USER', 'ASSIGN_NODE', 'REVOKE_NODE', 'CREATE_ADMIN', 'REMOVE_ADMIN', 'UPDATE_USER_DATA');

-- CreateEnum
CREATE TYPE "user_action_type" AS ENUM ('ALARM_ON', 'ALARM_OFF', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "audit_admin_actions" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" UUID NOT NULL,
    "affected_user_id" UUID,
    "node_id" INTEGER,
    "action_type" "admin_action_type" NOT NULL,
    "action_timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_value" JSONB,
    "new_value" JSONB,

    CONSTRAINT "audit_admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_user_actions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "node_id" INTEGER,
    "action_type" "user_action_type" NOT NULL,
    "action_timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "audit_user_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "rf_address" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_nodes" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "node_id" INTEGER NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(6),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "google_id" VARCHAR(255),
    "full_name" VARCHAR(255) NOT NULL,
    "age" INTEGER,
    "phone" VARCHAR(20),
    "address" TEXT,
    "reference" TEXT,
    "profile_photo" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'PENDING',
    "is_master" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_admin_audit_admin" ON "audit_admin_actions"("admin_id");

-- CreateIndex
CREATE INDEX "idx_admin_audit_user" ON "audit_admin_actions"("affected_user_id");

-- CreateIndex
CREATE INDEX "idx_user_audit_node" ON "audit_user_actions"("node_id");

-- CreateIndex
CREATE INDEX "idx_user_audit_user" ON "audit_user_actions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_code_key" ON "nodes"("code");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_node_assignment" ON "user_nodes"("user_id", "node_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "audit_admin_actions" ADD CONSTRAINT "audit_admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_admin_actions" ADD CONSTRAINT "audit_admin_actions_affected_user_id_fkey" FOREIGN KEY ("affected_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_admin_actions" ADD CONSTRAINT "audit_admin_actions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_user_actions" ADD CONSTRAINT "audit_user_actions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_user_actions" ADD CONSTRAINT "audit_user_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_nodes" ADD CONSTRAINT "user_nodes_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_nodes" ADD CONSTRAINT "user_nodes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_nodes" ADD CONSTRAINT "user_nodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
