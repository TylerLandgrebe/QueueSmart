import { randomUUID } from 'node:crypto'
import db from '../db/database.js'
import { findUserByUsername } from './usersData.js'

export const MAX_MESSAGE_LENGTH = 1000

// Map a notifications row to the shape the API and frontend expect
function toNotification(row) {
    if (!row) return null

    return {
        id: row.notification_id,
        userId: row.user_id,
        message: row.message,
        timestamp: row.timestamp,
        read: row.status === 'viewed'
    }
}

const insertNotification = db.prepare(`
    INSERT INTO notifications (notification_id, user_id, message, timestamp, status)
    VALUES (?, ?, ?, ?, ?)
`)

const insertNotificationIfMissing = db.prepare(`
    INSERT OR IGNORE INTO notifications (notification_id, user_id, message, timestamp, status)
    VALUES (?, ?, ?, ?, 'sent')
`)

const selectNotificationsByUser = db.prepare(`
    SELECT notification_id, user_id, message, timestamp, status
    FROM notifications
    WHERE user_id = ?
    ORDER BY timestamp, rowid
`)

const selectNotificationForUser = db.prepare(`
    SELECT notification_id, user_id, message, timestamp, status
    FROM notifications
    WHERE notification_id = ? AND user_id = ?
`)

const markViewed = db.prepare(`
    UPDATE notifications
    SET status = 'viewed'
    WHERE notification_id = ? AND user_id = ?
`)

// All of a user's notifications, oldest first
export function getNotificationsForUser(userId) {
    return selectNotificationsByUser.all(userId).map(toNotification)
}

export function createNotification(userId, message) {
    const notification = {
        id: randomUUID(),
        userId,
        message,
        timestamp: new Date().toISOString(),
        read: false
    }

    insertNotification.run(
        notification.id,
        notification.userId,
        notification.message,
        notification.timestamp,
        'sent'
    )

    return notification
}

// Returns the updated notification, or null if it doesn't exist or
// belongs to a different user
export function markNotificationAsRead(id, userId) {
    const { changes } = markViewed.run(id, userId)
    if (changes === 0) return null

    return toNotification(selectNotificationForUser.get(id, userId))
}

// Sample notifications for the seeded default user. Fixed IDs keep
// them from being duplicated each time the server starts.
const sampleUserId = findUserByUsername('user@email.com')?.id

if (sampleUserId) {
    insertNotificationIfMissing.run(
        'sample-notification-1',
        sampleUserId,
        "You joined the Academic Advising queue. Your current position is 3.",
        "2026-09-30T14:15:00"
    )
    insertNotificationIfMissing.run(
        'sample-notification-2',
        sampleUserId,
        "Your position in the Academic Advising queue has changed. Your new position is 2.",
        "2026-09-30T14:16:00"
    )
}

export function formatTimeStamp(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();

    const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

    if(isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
}
