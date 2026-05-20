CREATE TABLE IF NOT EXISTS agent_activities (
  id SERIAL PRIMARY KEY,
  session_key VARCHAR(255) UNIQUE NOT NULL,
  label VARCHAR(100),
  task TEXT,
  status VARCHAR(50), -- pending, running, done, failed
  model VARCHAR(100),
  runtime_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  error_message TEXT,
  parent_session VARCHAR(255)
);

CREATE INDEX idx_agent_status ON agent_activities(status);
CREATE INDEX idx_agent_started ON agent_activities(started_at DESC);