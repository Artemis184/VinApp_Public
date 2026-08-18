-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_prc_user" ON "password_reset_codes"("user_id");

-- CreateIndex
CREATE INDEX "idx_prc_expires" ON "password_reset_codes"("expires_at");

-- CreateIndex
CREATE INDEX "idx_prc_code_hash" ON "password_reset_codes"("code_hash");

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
