-- ============================================================
-- 003_seed.sql — Default admin + demo discovered hosts
-- Password for demo admin: changeme123 (bcrypt)
-- ============================================================

-- Default admin (password: changeme123 — CHANGE IN PRODUCTION)
INSERT INTO users (email, password_hash, role)
VALUES (
  'admin@wms.local',
  '$2b$12$x6Q0abfHza8xZb8KSA0kQ.n3587q7Ev4OBn.bg42CvNyulr5.MrKy',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
