/*
  Warnings:

  - You are about to drop the column `is_active` on the `nodes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "nodes" DROP COLUMN "is_active",
ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false;
