CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 20),
  score INTEGER NOT NULL CHECK(score >= 0),
  mode TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK(duration_ms > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_mode_rank
  ON scores(mode, score DESC, duration_ms ASC, created_at ASC);
