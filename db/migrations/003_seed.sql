-- ============================================================
-- 003_seed.sql — Default admin + demo discovered hosts
-- Password for demo admin: changeme123 (bcrypt)
-- ============================================================

-- Default admin (password: changeme123 — CHANGE IN PRODUCTION)
INSERT INTO users (email, password_hash, role)
VALUES (
  'admin@wms.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGsRgqFt1bSmHtxTSiOVhJe92AO',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
