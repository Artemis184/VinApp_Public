/*
  Warnings:

  - You are about to drop the `revoked_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "revoke_reason" AS ENUM ('LOGOUT', 'COMPROMISED', 'EXPIRED', 'MANUAL', 'PASSWORD_CHANGED');

-- DropForeignKey
ALTER TABLE "revoked_tokens" DROP CONSTRAINT "revoked_tokens_user_id_fkey";

-- DropTable
DROP TABLE "revoked_tokens";

-- CreateTable
CREATE TABLE "sessions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_id" VARCHAR(100) NOT NULL,
    "device_info" JSONB,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(6),
    "revoke_reason" "revoke_reason",
    "last_used_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_user_device" ON "sessions"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_device" ON "sessions"("device_id");

-- CreateIndex
CREATE INDEX "idx_sessions_expires" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
