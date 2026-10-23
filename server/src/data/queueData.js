import { randomUUID } from 'node:crypto'
import { services } from './servicesData.js'
import { notifications } from './notificationData.js'

// ---------------------------------------------------------------------------
// Shared queue-entry store.
//
// The user portal (join / leave / status / history) and the admin portal
// (queue management, serve next) read and write THIS array, so both sides
// always see the same queue.
//
// Entry shape:
//   {
//     id:        string (uuid)
//     userId:    string  -> users[].id
//     username:  string  (shown to admins in the queue table)
//     serviceId: string  -> services[].id
//     priority:  'High' | 'Medium' | 'Low'   (the service's priority when the user joined)
//     joinedAt:  number  (ms since epoch)
//     endedAt:   number | null (ms since epoch; null while waiting)
//     status:    'waiting' | 'served' | 'left' | 'removed'
//   }
//
// Queue order within a service: priority first (High, Medium, Low), then
// arrival time. Entries that tie keep their insertion order.
// ---------------------------------------------------------------------------

export const queueEntries = []

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }

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
    return queueEntries
        .filter(entry => entry.serviceId === serviceId && entry.status === 'waiting')
        .sort((first, second) =>
            PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority]
            || first.joinedAt - second.joinedAt)
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
    return queueEntries.find(
        entry =>
            entry.userId === userId &&
            entry.serviceId === serviceId &&
            entry.status === ENTRY_STATUS.WAITING
    )
}

// Every queue the user is currently waiting in, oldest join first.
export function getUserActiveEntries(userId) {
    return queueEntries
        .filter(entry => entry.userId === userId && entry.status === ENTRY_STATUS.WAITING)
        .sort((a, b) => a.joinedAt - b.joinedAt)
}

// Past (not waiting) entries for the user, most recently ended first.
export function getUserHistory(userId) {
    return queueEntries
        .filter(entry => entry.userId === userId && entry.status !== ENTRY_STATUS.WAITING)
        .sort((a, b) => {
            const endedDiff = (b.endedAt ?? b.joinedAt) - (a.endedAt ?? a.joinedAt)
            return endedDiff !== 0 ? endedDiff : b.joinedAt - a.joinedAt
        })
}

// Entries served within the last few minutes, newest first. Lets the Queue
// Status screen show "Served" instead of the card silently disappearing.
export function getRecentlyServed(userId, now = Date.now()) {
    return queueEntries
        .filter(entry => {
            if (entry.userId !== userId || entry.status !== ENTRY_STATUS.SERVED) return false
            const age = now - entry.endedAt
            return age >= 0 && age <= RECENTLY_SERVED_WINDOW_MS
        })
        .sort((a, b) => b.endedAt - a.endedAt)
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
    if (entry.status !== ENTRY_STATUS.WAITING) return entry

    const waitingBefore = getWaitingEntriesForService(entry.serviceId)
    const endedIndex = waitingBefore.findIndex(item => item.id === entry.id)

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
export function joinQueue(userId, serviceId, username) {
    if (typeof serviceId !== 'string' || !serviceId.trim()) {
        return { error: 'A valid serviceId is required', code: 'invalid' }
    }
    if (serviceId.length > MAX_SERVICE_ID_LENGTH) {
        return { error: `serviceId must be ${MAX_SERVICE_ID_LENGTH} characters or fewer`, code: 'invalid' }
    }

    const service = findService(serviceId)
    if (!service) return { error: 'Service not found', code: 'not-found' }
    if (!service.isOpen) return { error: 'This queue is currently closed', code: 'closed' }
    if (findWaitingEntry(userId, serviceId)) {
        return { error: 'You are already in this queue', code: 'duplicate' }
    }

    const entry = {
        id: randomUUID(),
        userId,
        username: username ?? null,
        serviceId,
        priority: service.priority,
        joinedAt: Date.now(),
        endedAt: null,
        status: ENTRY_STATUS.WAITING
    }
    queueEntries.push(entry)
    notifyUser(
        userId,
        `You joined the ${service.name} queue. Your current position is ${getPosition(entry)}.`
    )
    return { entry }
}

// Returns { entry } on success, or { error, code } where code is
// 'not-found' (unknown id, or someone else's entry) | 'not-active'.
export function leaveQueue(userId, entryId) {
    const entry = queueEntries.find(item => item.id === entryId && item.userId === userId)
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
