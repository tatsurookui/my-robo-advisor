CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  risk_score INTEGER CHECK (risk_score BETWEEN 3 AND 9),
  risk_profile TEXT CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
