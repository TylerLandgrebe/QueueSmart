import db from '../../src/db/database.js'
import { toDbStatus, fromDbStatus } from '../../src/data/queueData.js'

// Test helpers for the queue_entries table. Tests used to push straight onto
// an in-memory array; these do the same job against the real database.

// Remove every queue entry. Call this BEFORE resetUsers(): queue_entries
// references user_credentials, so users with entries cannot be deleted.
export function clearQueueEntries() {
    db.prepare('DELETE FROM queue_entries').run()
}

// Insert one entry (and its user, if missing) with fixed values so ordering
// assertions are deterministic. Mirrors the shape the app returns:
// { id, userId, username, serviceId, priority, joinedAt, endedAt, status }
export function insertEntry({
    id,
    userId = `user-${id}`,
    username = `${userId}@example.com`,
    serviceId = 'advising',
    priority = 'Medium',
    joinedAt,
    endedAt = null,
    status = 'waiting'
}) {
    const queue = db.prepare(`
        SELECT queue_id FROM queues
        WHERE service_id = ?
        ORDER BY status = 'open' DESC
        LIMIT 1
    `).get(serviceId)

    db.prepare(`
        INSERT OR IGNORE INTO user_credentials (user_id, email, password_hash, role)
        VALUES (?, ?, 'not-a-real-hash', 'user')
    `).run(userId, username)

    db.prepare(`
        INSERT INTO queue_entries (entry_id, queue_id, user_id, priority, joined_at, ended_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, queue.queue_id, userId, priority, joinedAt, endedAt, toDbStatus(status))
}

// Replace all entries with the given list
export function resetQueueEntries(entries = []) {
    const reset = db.transaction(() => {
        clearQueueEntries()
        entries.forEach(insertEntry)
    })

    reset()
}

// Every stored entry in insertion order, in the app's entry shape
export function getAllEntries() {
    return db.prepare(`
        SELECT e.entry_id AS id, e.user_id AS userId, u.email AS username,
               q.service_id AS serviceId, e.priority, e.joined_at AS joinedAt,
               e.ended_at AS endedAt, e.status
        FROM queue_entries e
        JOIN queues q ON q.queue_id = e.queue_id
        JOIN user_credentials u ON u.user_id = e.user_id
        ORDER BY e.rowid
    `).all().map(row => ({ ...row, status: fromDbStatus(row.status) }))
}

// The raw status stored in the database column (e.g. 'canceled', not 'left')
export function getStoredStatus(entryId) {
    return db.prepare('SELECT status FROM queue_entries WHERE entry_id = ?').get(entryId)?.status
}
