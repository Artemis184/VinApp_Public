-- CreateEnum
CREATE TYPE "node_communication_method" AS ENUM ('rf', 'wifi', 'auto');

-- AlterTable
ALTER TABLE "nodes"
ADD COLUMN IF NOT EXISTS "communication_method" "node_communication_method" NOT NULL DEFAULT 'auto';
