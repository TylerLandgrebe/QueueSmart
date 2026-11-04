CREATE TABLE IF NOT EXISTS user_credentials (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (length(trim(email)) BETWEEN 3 and 254),
    password_hash TEXT NOT NULL
        CHECK (length(password_hash) BETWEEN 1 and 255),
    role TEXT NOT NULL CHECK (role IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY
        REFERENCES user_credentials(user_id) ON DELETE CASCADE,
    full_name TEXT NOT NULL
        CHECK (length(trim(full_name)) BETWEEN 1 AND 150),
    contact_info TEXT
        CHECK (contact_info IS NULL OR LENGTH (contact_info) <= 100),
    preferences TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
    duration INTEGER NOT NULL CHECK (duration BETWEEN 1 AND 480),
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High'))
);

CREATE TABLE IF NOT EXISTS queues (
    queue_id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_queue_per_service
ON queues(service_id)
WHERE status = 'open';

CREATE TABLE IF NOT EXISTS queue_entries (
    entry_id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL
        REFERENCES queues(queue_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL
        REFERENCES user_credentials(user_id),
    priority TEXT NOT NULL
        CHECK (priority IN ('Low', 'Medium', 'High')),
    joined_at INTEGER NOT NULL,
    ended_at INTEGER,
    status TEXT NOT NULL
        CHECK (status IN ('waiting', 'served', 'canceled', 'removed')),
    CHECK(
        (status = 'waiting' AND ended_at IS NULL) OR
        (status <> 'waiting' AND ended_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS one_waiting_entry_per_user_per_queue
ON queue_entries(queue_id, user_id)
WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS notifications (
    notification_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL
        REFERENCES user_credentials(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL 
        CHECK (length(trim(message)) BETWEEN 1 AND 1000),
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'viewed'))
);

CREATE INDEX IF NOT EXISTS notifications_by_user_and_time
ON notifications(user_id, timestamp DESC);