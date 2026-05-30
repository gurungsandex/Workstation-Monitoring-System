-- ============================================================
-- 002_timescale.sql — Metrics table + 30-min aggregate view
-- Works on plain PostgreSQL 14+ AND TimescaleDB.
-- TimescaleDB-specific commands (hypertable, compression,
-- continuous aggregate) are attempted inside exception blocks
-- so the migration never fails on vanilla Postgres.
-- ============================================================

-- ------------------------------------------------------------
-- Metrics time-series table (plain Postgres compatible)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics (
  time              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workstation_id    UUID        NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  -- CPU
  cpu_usage         FLOAT,
  cpu_temp          FLOAT,
  cpu_per_core      JSONB,
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
  net_eth_in        FLOAT,
  net_eth_out       FLOAT,
  net_down_mbps     FLOAT,
  net_up_mbps       FLOAT,
  -- System
  uptime_sec        BIGINT
);

CREATE INDEX IF NOT EXISTS idx_metrics_ws_time
  ON metrics (workstation_id, time DESC);

-- ------------------------------------------------------------
-- TimescaleDB enhancements (silently skipped if not installed)
-- ------------------------------------------------------------
DO $$
BEGIN
  -- Try to load TimescaleDB
  BEGIN
    CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB not available — skipping hypertable setup';
    RETURN;
  END;

  -- Convert to hypertable
  PERFORM create_hypertable(
    'metrics', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
  );

  -- Compression policy
  BEGIN
    ALTER TABLE metrics SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'workstation_id',
      timescaledb.compress_orderby   = 'time DESC'
    );
    PERFORM add_compression_policy('metrics', INTERVAL '1 day', if_not_exists => TRUE);
    PERFORM add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Compression/retention policy skipped: %', SQLERRM;
  END;
END;
$$;

-- ------------------------------------------------------------
-- 30-minute aggregate view
-- Uses TimescaleDB continuous aggregate when available,
-- otherwise a standard Postgres view (slightly slower but works).
-- ------------------------------------------------------------
DO $$
BEGIN
  -- Try TimescaleDB continuous aggregate first
  BEGIN
    EXECUTE $q$
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_30m
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('30 minutes', time) AS bucket,
        workstation_id,
        AVG(cpu_usage)      AS avg_cpu,
        AVG(cpu_temp)       AS avg_cpu_temp,
        AVG(ram_used_pct)   AS avg_ram,
        AVG(disk_used_pct)  AS avg_disk,
        AVG(disk_read_mbs)  AS avg_disk_read,
        AVG(disk_write_mbs) AS avg_disk_write,
        AVG(gpu_load)       AS avg_gpu,
        AVG(gpu_temp)       AS avg_gpu_temp,
        AVG(net_eth_in)     AS avg_net_in,
        AVG(net_eth_out)    AS avg_net_out,
        AVG(net_down_mbps)  AS avg_net_down,
        AVG(net_up_mbps)    AS avg_net_up
      FROM metrics
      GROUP BY bucket, workstation_id
      WITH NO DATA
    $q$;

    PERFORM add_continuous_aggregate_policy(
      'metrics_30m',
      start_offset      => INTERVAL '24 hours',
      end_offset        => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute',
      if_not_exists     => TRUE
    );

    RAISE NOTICE 'TimescaleDB continuous aggregate metrics_30m created.';
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    -- Fall through to plain view
  END;

  -- Fallback: plain SQL view (works on vanilla Postgres)
  EXECUTE $q$
    CREATE OR REPLACE VIEW metrics_30m AS
    SELECT
      date_trunc('hour', time) + INTERVAL '30 min' * FLOOR(
        EXTRACT(MINUTE FROM time) / 30
      ) AS bucket,
      workstation_id,
      AVG(cpu_usage)      AS avg_cpu,
      AVG(cpu_temp)       AS avg_cpu_temp,
      AVG(ram_used_pct)   AS avg_ram,
      AVG(disk_used_pct)  AS avg_disk,
      AVG(disk_read_mbs)  AS avg_disk_read,
      AVG(disk_write_mbs) AS avg_disk_write,
      AVG(gpu_load)       AS avg_gpu,
      AVG(gpu_temp)       AS avg_gpu_temp,
      AVG(net_eth_in)     AS avg_net_in,
      AVG(net_eth_out)    AS avg_net_out,
      AVG(net_down_mbps)  AS avg_net_down,
      AVG(net_up_mbps)    AS avg_net_up
    FROM metrics
    GROUP BY 1, workstation_id
  $q$;

  RAISE NOTICE 'Plain SQL view metrics_30m created (no TimescaleDB).';
END;
$$;
