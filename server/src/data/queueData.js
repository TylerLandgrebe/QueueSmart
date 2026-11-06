import { randomUUID } from 'node:crypto'
import db from '../db/database.js'
import { services } from './servicesData.js'
import { notifications } from './notificationData.js'

// ---------------------------------------------------------------------------
// Shared queue-entry store (SQLite: `queue_entries` joined to `queues`).
//
// The user portal (join / leave / status / history) and the admin portal
// (queue management, serve next) read and write the same rows, so both sides
// always see the same queue and the data survives a server restart.
//
// Entry shape returned by this module (unchanged from the in-memory version,
// so routes, views and the front end did not need to change):
//   {
//     id:        string (uuid)                      <- queue_entries.entry_id
//     userId:    string  -> user_credentials.user_id
//     username:  string  (the user's email; shown to admins in the queue table)
//     serviceId: string  -> services.id             <- queues.service_id
//     priority:  'High' | 'Medium' | 'Low'   (the service's priority when the user joined)
//     joinedAt:  number  (ms since epoch)
//     endedAt:   number | null (ms since epoch; null while waiting)
//     status:    'waiting' | 'served' | 'left' | 'removed'
//   }
//
// The API calls a user who left the queue 'left'; the database column
// (see schema.sql) calls the same thing 'canceled'. toDbStatus()/fromDbStatus()
// translate at this boundary and nowhere else.
//
// There is deliberately no stored "position" column. Position depends on
// priority and arrival time and changes whenever anyone ahead leaves or is
// served, so it is always computed from the waiting rows.
//
// Queue order within a service: priority first (High, Medium, Low), then
// arrival time. Entries that tie keep their insertion order (rowid).
// ---------------------------------------------------------------------------

const DB_STATUS_FOR = { left: 'canceled' }
const API_STATUS_FOR = { canceled: 'left' }

export const toDbStatus = status => DB_STATUS_FOR[status] ?? status
export const fromDbStatus = status => API_STATUS_FOR[status] ?? status

const ENTRY_SELECT = `
    SELECT
        e.entry_id  AS id,
        e.user_id   AS userId,
        u.email     AS username,
        q.service_id AS serviceId,
        e.priority  AS priority,
        e.joined_at AS joinedAt,
        e.ended_at  AS endedAt,
        e.status    AS status
    FROM queue_entries e
    JOIN queues q            ON q.queue_id = e.queue_id
    JOIN user_credentials u  ON u.user_id = e.user_id
`

// Priority first, then arrival time, then insertion order
const QUEUE_ORDER = `
    ORDER BY
        CASE e.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
        e.joined_at,
        e.rowid
`

const toEntry = row => (row ? { ...row, status: fromDbStatus(row.status) } : undefined)

const selectEntryById = db.prepare(`${ENTRY_SELECT} WHERE e.entry_id = ?`)

const selectWaitingForService = db.prepare(`
    ${ENTRY_SELECT}
    WHERE q.service_id = ? AND e.status = 'waiting'
    ${QUEUE_ORDER}
`)

const selectWaitingForUserAndService = db.prepare(`
    ${ENTRY_SELECT}
    WHERE e.user_id = ? AND q.service_id = ? AND e.status = 'waiting'
`)

const selectActiveForUser = db.prepare(`
    ${ENTRY_SELECT}
    WHERE e.user_id = ? AND e.status = 'waiting'
    ORDER BY e.joined_at, e.rowid
`)

const selectHistoryForUser = db.prepare(`
    ${ENTRY_SELECT}
    WHERE e.user_id = ? AND e.status <> 'waiting'
    ORDER BY COALESCE(e.ended_at, e.joined_at) DESC, e.joined_at DESC, e.rowid
`)

const selectRecentlyServed = db.prepare(`
    ${ENTRY_SELECT}
    WHERE e.user_id = ? AND e.status = 'served'
        AND e.ended_at <= ? AND e.ended_at >= ?
    ORDER BY e.ended_at DESC, e.rowid
`)

// The queue a new entry joins: the service's open queue, if it has one.
const selectOpenQueueId = db.prepare(`
    SELECT queue_id FROM queues WHERE service_id = ? AND status = 'open'
`)

const insertEntry = db.prepare(`
    INSERT INTO queue_entries (entry_id, queue_id, user_id, priority, joined_at, ended_at, status)
    VALUES (?, ?, ?, ?, ?, NULL, 'waiting')
`)

// Only a waiting entry can be ended, so history can never be overwritten.
const markEntryEnded = db.prepare(`
    UPDATE queue_entries
    SET status = ?, ended_at = ?
    WHERE entry_id = ? AND status = 'waiting'
`)

export function getEntryById(entryId) {
    return toEntry(selectEntryById.get(entryId))
}

// ---------- admin queue + wait-time logic ----------

export function getQueue(service) {
    const queue = getWaitingEntriesForService(service.id).map((entry, index) => ({
        ...entry,
        position: index + 1,
        estimatedWaitMinutes: index * service.duration,
    }))

    return {
        ...service,
        queue,
        queueLength: queue.length,
        estimatedWaitMinutes: queue.length * service.duration,
    }
}

export function getWaitingEntriesForService(serviceId) {
    return selectWaitingForService.all(serviceId).map(toEntry)
}

// Serves the person at the front of the queue. Goes through endEntry() so the
// served user, and everyone behind them, are notified.
export function serveNext(serviceId) {
    const nextEntry = getWaitingEntriesForService(serviceId)[0]
    if (!nextEntry) return null

    return endEntry(nextEntry, ENTRY_STATUS.SERVED)
}

// ---------- user queue + history logic ----------

export const ENTRY_STATUS = Object.freeze({
    WAITING: 'waiting',
    SERVED: 'served',
    LEFT: 'left',
    REMOVED: 'removed'
})

const ENDED_STATUSES = new Set([ENTRY_STATUS.SERVED, ENTRY_STATUS.LEFT, ENTRY_STATUS.REMOVED])

const OUTCOME_LABELS = {
    [ENTRY_STATUS.SERVED]: 'Served',
    [ENTRY_STATUS.LEFT]: 'Left queue',
    [ENTRY_STATUS.REMOVED]: 'Removed by staff'
}

export const MAX_SERVICE_ID_LENGTH = 100

// A served entry stays visible on the user's Queue Status screen this long
export const RECENTLY_SERVED_WINDOW_MS = 15 * 60 * 1000

// ---------- notifications ----------

// Queue events create in-app notifications in the shared notification store,
// using the same shape as the notification routes. If the notification module
// later exposes its own "create" function, swap it in here (one place).
function notifyUser(userId, message) {
    if (!userId) return
    notifications.push({
        id: randomUUID(),
        userId,
        message,
        timestamp: new Date().toISOString(),
        read: false
    })
}

function serviceName(serviceId) {
    return findService(serviceId)?.name ?? 'Unknown service'
}

const ENDED_MESSAGES = {
    [ENTRY_STATUS.SERVED]: name => `You have been served at ${name}.`,
    [ENTRY_STATUS.LEFT]: name => `You have left the ${name} queue.`,
    [ENTRY_STATUS.REMOVED]: name => `You were removed from the ${name} queue by staff.`
}

// Position 1 is the "close to being served" alert
function positionMessage(name, position) {
    return position === 1
        ? `You're next in the ${name} queue. Please be ready.`
        : `Your position in the ${name} queue has changed. Your new position is ${position}.`
}

// ---------- lookups ----------

export function findService(serviceId) {
    return services.find(service => service.id === serviceId)
}

export function findWaitingEntry(userId, serviceId) {
    return toEntry(selectWaitingForUserAndService.get(userId, serviceId))
}

// Every queue the user is currently waiting in, oldest join first.
export function getUserActiveEntries(userId) {
    return selectActiveForUser.all(userId).map(toEntry)
}

// Past (not waiting) entries for the user, most recently ended first.
export function getUserHistory(userId) {
    return selectHistoryForUser.all(userId).map(toEntry)
}

// Entries served within the last few minutes, newest first. Lets the Queue
// Status screen show "Served" instead of the card silently disappearing.
export function getRecentlyServed(userId, now = Date.now()) {
    return selectRecentlyServed
        .all(userId, now, now - RECENTLY_SERVED_WINDOW_MS)
        .map(toEntry)
}

// ---------- position / wait ----------

// 1-based position in the service's queue, or null if the entry isn't waiting.
export function getPosition(entry) {
    const index = getWaitingEntriesForService(entry.serviceId).findIndex(item => item.id === entry.id)
    return index === -1 ? null : index + 1
}

// Minutes until this position is served: everyone ahead takes `duration` each.
// Same rule getQueue() applies to each entry (index * duration).
export function estimateWaitMinutes(position, service) {
    if (!Number.isInteger(position) || position < 1 || !service) return 0
    return (position - 1) * service.duration
}

// Position 1 means "you're next".
export function getQueueStage(position) {
    return position === 1 ? 'almost-ready' : 'waiting'
}

// Waiting count and the wait a person joining right now would face,
// taken from the same getQueue() the admin screens use.
export function getQueueSummary() {
    return services.map(service => {
        const { queueLength, estimatedWaitMinutes } = getQueue(service)
        return { serviceId: service.id, waiting: queueLength, estimatedWait: estimatedWaitMinutes }
    })
}

// ---------- changes ----------

// Close out an entry. Used by "leave" (user), "serve next" (admin) and
// reusable for "removed". Every path notifies the affected users: the person
// whose entry ended, and everyone behind them (who each move up one place;
// the new front of the queue gets the "you're next" alert).
// An entry that already ended is left untouched, so history can't be
// overwritten by a repeated call.
export function endEntry(entry, status, endedAt = Date.now()) {
    if (!ENDED_STATUSES.has(status)) {
        throw new Error(`Invalid ended status: ${status}`)
    }
    if (!Number.isFinite(Number(endedAt))) {
        throw new Error(`Invalid end time: ${endedAt}`)
    }
    if (entry.status !== ENTRY_STATUS.WAITING) return entry

    const waitingBefore = getWaitingEntriesForService(entry.serviceId)
    const endedIndex = waitingBefore.findIndex(item => item.id === entry.id)

    const { changes } = markEntryEnded.run(toDbStatus(status), Number(endedAt), entry.id)
    if (changes === 0) {
        // Someone else ended it since the caller loaded it: keep what the
        // database says, and send no notifications.
        return Object.assign(entry, getEntryById(entry.id))
    }

    entry.status = status
    entry.endedAt = Number(endedAt)

    const name = serviceName(entry.serviceId)
    notifyUser(entry.userId, ENDED_MESSAGES[status](name))

    if (endedIndex !== -1) {
        waitingBefore.slice(endedIndex + 1).forEach((other, offset) => {
            notifyUser(other.userId, positionMessage(name, endedIndex + 1 + offset))
        })
    }

    return entry
}

// Returns { entry } on success, or { error, code } where code is one of
// 'invalid' | 'not-found' | 'closed' | 'duplicate'.
// `username` is no longer stored: it is read from user_credentials.email.
export function joinQueue(userId, serviceId) {
    if (typeof serviceId !== 'string' || !serviceId.trim()) {
        return { error: 'A valid serviceId is required', code: 'invalid' }
    }
    if (serviceId.length > MAX_SERVICE_ID_LENGTH) {
        return { error: `serviceId must be ${MAX_SERVICE_ID_LENGTH} characters or fewer`, code: 'invalid' }
    }

    const service = findService(serviceId)
    if (!service) return { error: 'Service not found', code: 'not-found' }

    // The open queue row is the source of truth for "can people join?"
    const openQueue = selectOpenQueueId.get(serviceId)
    if (!service.isOpen || !openQueue) {
        return { error: 'This queue is currently closed', code: 'closed' }
    }
    if (findWaitingEntry(userId, serviceId)) {
        return { error: 'You are already in this queue', code: 'duplicate' }
    }

    const entryId = randomUUID()
    try {
        insertEntry.run(entryId, openQueue.queue_id, userId, service.priority, Date.now())
    } catch (error) {
        // The database enforces these too, so a double-click or two racing
        // requests cannot create a second waiting row.
        if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return { error: 'You are already in this queue', code: 'duplicate' }
        }
        if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return { error: 'User not found', code: 'not-found' }
        }
        throw error
    }

    // Read the saved row back so callers see exactly what was persisted
    const entry = getEntryById(entryId)
    notifyUser(
        userId,
        `You joined the ${service.name} queue. Your current position is ${getPosition(entry)}.`
    )
    return { entry }
}

// Returns { entry } on success, or { error, code } where code is
// 'not-found' (unknown id, or someone else's entry) | 'not-active'.
export function leaveQueue(userId, entryId) {
    const found = typeof entryId === 'string' ? getEntryById(entryId) : undefined
    const entry = found?.userId === userId ? found : undefined
    if (!entry) return { error: 'Queue entry not found', code: 'not-found' }
    if (entry.status !== ENTRY_STATUS.WAITING) {
        return { error: 'You are no longer in this queue', code: 'not-active' }
    }

    endEntry(entry, ENTRY_STATUS.LEFT)
    return { entry }
}

// ---------- response shapes ----------

export function toActiveEntryView(entry) {
    const service = findService(entry.serviceId)
    const position = getPosition(entry)

    return {
        id: entry.id,
        serviceId: entry.serviceId,
        serviceName: service?.name ?? 'Unknown service',
        priority: entry.priority ?? service?.priority ?? null,
        duration: service?.duration ?? 0,
        joinedAt: entry.joinedAt,
        status: entry.status,
        position,
        estimatedWait: estimateWaitMinutes(position, service),
        stage: getQueueStage(position)
    }
}

export function toServedView(entry) {
    return {
        id: entry.id,
        serviceId: entry.serviceId,
        serviceName: serviceName(entry.serviceId),
        servedAt: entry.endedAt,
        status: entry.status,
        stage: 'served'
    }
}

export function toHistoryView(entry) {
    return {
        id: entry.id,
        serviceId: entry.serviceId,
        serviceName: serviceName(entry.serviceId),
        joinedAt: entry.joinedAt,
        endedAt: entry.endedAt,
        status: entry.status,
        outcome: OUTCOME_LABELS[entry.status] ?? entry.status
    }
}
