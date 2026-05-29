-- ============================================================
-- 001_init.sql — Core relational schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Users (admin auth)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Discovered hosts (from network scans, not yet enrolled)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovered_hosts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip            INET NOT NULL,
  mac           TEXT,
  hostname      TEXT,
  vendor        TEXT,
  open_ports    JSONB DEFAULT '[]',
  os_guess      TEXT,
  last_scanned  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workstation_id UUID,  -- set once enrolled
  UNIQUE (ip)
);

-- ------------------------------------------------------------
-- Workstations (enrolled devices)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workstations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname            TEXT NOT NULL,
  ip                  INET,
  mac                 TEXT,
  dept                TEXT,
  owner_name          TEXT,
  os_name             TEXT,
  os_short            TEXT,
  os_family           TEXT CHECK (os_family IN ('windows','mac','linux')),
  cpu_model           TEXT,
  cpu_cores           INT,
  ram_total_gb        FLOAT,
  gpu_model           TEXT,
  disk_size           TEXT,
  disk_type           TEXT,
  status              TEXT NOT NULL DEFAULT 'offline'
                        CHECK (status IN ('healthy','warning','critical','offline')),
  health_score        INT DEFAULT 0,
  health_factors      JSONB DEFAULT '[]',
  enrollment_token    TEXT UNIQUE,           -- one-time token for first agent contact
  agent_secret_hash   TEXT,                  -- bcrypt of long-lived agent credential
  agent_version       TEXT,
  enrolled_at         TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  time_in_state_min   INT DEFAULT 0,
  uptime_sec          BIGINT DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- latest snapshot (denormalised for fast list queries)
  snap_cpu_usage      FLOAT,
  snap_cpu_temp       FLOAT,
  snap_ram_used_pct   FLOAT,
  snap_disk_used_pct  FLOAT,
  snap_disk_read_mbs  FLOAT,
  snap_disk_write_mbs FLOAT,
  snap_gpu_load       FLOAT,
  snap_gpu_temp       FLOAT,
  snap_net_eth_in     FLOAT,
  snap_net_eth_out    FLOAT,
  snap_net_down_mbps  FLOAT,
  snap_net_up_mbps    FLOAT
);

ALTER TABLE discovered_hosts
  ADD CONSTRAINT fk_dh_workstation
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Alerts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id UUID NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  metric         TEXT NOT NULL,
  value          TEXT,
  threshold      TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('critical','warning')),
  action         TEXT,
  is_resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  is_ack         BOOLEAN NOT NULL DEFAULT FALSE,
  ack_by         TEXT,
  ack_at         TIMESTAMPTZ,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,
  duration_min   INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - started_at)) / 60
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_alerts_ws    ON alerts (workstation_id, is_resolved, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_open  ON alerts (is_resolved, started_at DESC)
  WHERE is_resolved = FALSE;

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    JSONB,
  ip_addr     INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (created_at DESC);

-- ------------------------------------------------------------
-- Scan sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidr         TEXT NOT NULL,
  started_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  host_count   INT DEFAULT 0,
  status       TEXT DEFAULT 'running' CHECK (status IN ('running','done','error'))
);
