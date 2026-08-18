-- CreateTable
CREATE TABLE "revoked_tokens" (
    "id" BIGSERIAL NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revoked_tokens_token_hash_key" ON "revoked_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_revoked_token_hash" ON "revoked_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_revoked_token_user" ON "revoked_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_revoked_token_expires" ON "revoked_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
