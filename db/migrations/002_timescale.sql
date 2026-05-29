-- ============================================================
-- 002_timescale.sql — TimescaleDB hypertable for metrics
-- Run AFTER TimescaleDB extension is available.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ------------------------------------------------------------
-- Metrics time-series table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics (
  time              TIMESTAMPTZ NOT NULL,
  workstation_id    UUID        NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  -- CPU
  cpu_usage         FLOAT,
  cpu_temp          FLOAT,
  cpu_per_core      JSONB,          -- float[]
  -- RAM
  ram_used_pct      FLOAT,
  -- Disk
  disk_used_pct     FLOAT,
  disk_read_mbs     FLOAT,
  disk_write_mbs    FLOAT,
  -- GPU
  gpu_load          FLOAT,
  gpu_temp          FLOAT,
  -- Network
  net_eth_in        FLOAT,          -- MB/s from NIC
  net_eth_out       FLOAT,
  net_down_mbps     FLOAT,          -- internet downlink
  net_up_mbps       FLOAT,
  -- System
  uptime_sec        BIGINT
);

-- Convert to hypertable (7-day chunks, compress after 1 day)
SELECT create_hypertable(
  'metrics', 'time',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

ALTER TABLE metrics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'workstation_id',
  timescaledb.compress_orderby   = 'time DESC'
);

SELECT add_compression_policy('metrics', INTERVAL '1 day', if_not_exists => TRUE);
SELECT add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- Continuous aggregates for 24h dashboard charts (30-min buckets)
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_30m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('30 minutes', time) AS bucket,
  workstation_id,
  AVG(cpu_usage)       AS avg_cpu,
  AVG(cpu_temp)        AS avg_cpu_temp,
  AVG(ram_used_pct)    AS avg_ram,
  AVG(disk_used_pct)   AS avg_disk,
  AVG(disk_read_mbs)   AS avg_disk_read,
  AVG(disk_write_mbs)  AS avg_disk_write,
  AVG(gpu_load)        AS avg_gpu,
  AVG(gpu_temp)        AS avg_gpu_temp,
  AVG(net_eth_in)      AS avg_net_in,
  AVG(net_eth_out)     AS avg_net_out,
  AVG(net_down_mbps)   AS avg_net_down,
  AVG(net_up_mbps)     AS avg_net_up
FROM metrics
GROUP BY bucket, workstation_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'metrics_30m',
  start_offset  => INTERVAL '24 hours',
  end_offset    => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_ws_time
  ON metrics (workstation_id, time DESC);
