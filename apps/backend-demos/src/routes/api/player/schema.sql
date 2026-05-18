CREATE TABLE IF NOT EXISTS demo_items (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT NOT NULL,
	config_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_sessions (
	id TEXT PRIMARY KEY,
	item_id TEXT NOT NULL,
	data_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (item_id) REFERENCES demo_items(id)
);
