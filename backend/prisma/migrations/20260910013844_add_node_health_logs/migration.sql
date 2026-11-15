-- AlterTable
ALTER TABLE "nodes" ALTER COLUMN "communication_method" SET DEFAULT 'rf';

-- CreateTable
CREATE TABLE "node_health_logs" (
    "id" BIGSERIAL NOT NULL,
    "node_id" INTEGER NOT NULL,
    "rf_node" INTEGER NOT NULL,
    "radio_reinits" INTEGER NOT NULL DEFAULT 0,
    "boots" INTEGER NOT NULL DEFAULT 0,
    "rx_count" INTEGER NOT NULL DEFAULT 0,
    "uptime_hours" INTEGER NOT NULL DEFAULT 0,
    "abnormal_reset" BOOLEAN NOT NULL DEFAULT false,
    "reinit_this_session" BOOLEAN NOT NULL DEFAULT false,
    "via_repeater" VARCHAR(10),
    "recorded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_node_health_node_time" ON "node_health_logs"("node_id", "recorded_at");

-- CreateIndex
CREATE INDEX "idx_node_health_time" ON "node_health_logs"("recorded_at");

-- CreateIndex
CREATE INDEX "idx_node_health_abnormal" ON "node_health_logs"("abnormal_reset");

-- AddForeignKey
ALTER TABLE "node_health_logs" ADD CONSTRAINT "node_health_logs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
