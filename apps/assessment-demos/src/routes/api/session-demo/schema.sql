PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS attempt_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	assessment_id TEXT NOT NULL,
	attempt_id TEXT NOT NULL,
	demo_user_id TEXT NOT NULL,
	current_section_identifier TEXT NOT NULL DEFAULT '',
	visited_section_identifiers TEXT NOT NULL DEFAULT '[]',
	section_identifiers TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(assessment_id, attempt_id, demo_user_id)
);

CREATE TABLE IF NOT EXISTS section_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	attempt_session_id INTEGER NOT NULL,
	section_id TEXT NOT NULL,
	current_item_index INTEGER NOT NULL DEFAULT 0,
	visited_item_identifiers TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(attempt_session_id, section_id),
	FOREIGN KEY (attempt_session_id) REFERENCES attempt_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS item_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	section_session_id INTEGER NOT NULL,
	item_id TEXT NOT NULL,
	canonical_item_id TEXT NOT NULL,
	session_payload TEXT NOT NULL,
	complete INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL,
	UNIQUE(section_session_id, canonical_item_id),
	FOREIGN KEY (section_session_id) REFERENCES section_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempt_sessions_lookup
	ON attempt_sessions(assessment_id, attempt_id, demo_user_id);

CREATE INDEX IF NOT EXISTS idx_section_sessions_lookup
	ON section_sessions(attempt_session_id, section_id);

CREATE INDEX IF NOT EXISTS idx_item_sessions_lookup
	ON item_sessions(section_session_id, canonical_item_id);
