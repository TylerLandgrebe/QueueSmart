import db from '../../src/db/database.js'

export function resetNotifications() {
    db.prepare('DELETE FROM notifications').run()
}

// Every stored notification in the API shape, in the order they were created
export function getAllNotifications() {
    return db.prepare(`
        SELECT notification_id AS id, user_id AS userId, message, timestamp, status
        FROM notifications
        ORDER BY rowid
    `).all().map(({ status, ...note }) => ({ ...note, read: status === 'viewed' }))
}
