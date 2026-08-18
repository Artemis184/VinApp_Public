-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "is_alarm_on" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_failure_at" TIMESTAMP(6),
ALTER COLUMN "is_online" SET DEFAULT true;
