import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'

import app from '../src/app.js'
import db from '../src/db/database.js'
import { services } from '../src/data/servicesData.js'
import { resetNotifications, getAllNotifications } from './helpers/notifications.js'
import { resetUsers } from './helpers/users.js'
import {
    clearQueueEntries,
    insertEntry,
    getAllEntries,
    getStoredStatus
} from './helpers/queueEntries.js'
import {
    joinQueue,
    leaveQueue,
    endEntry,
    getEntryById,
    getUserHistory,
    getUserActiveEntries,
    getRecentlyServed,
    findWaitingEntry,
    toDbStatus,
    fromDbStatus,
    RECENTLY_SERVED_WINDOW_MS
} from '../src/data/queueData.js'

// Assignment 4: queue entries are stored in the queue_entries table.
// These tests look at the database itself, not only at what the API returns.

const PASSWORD = 'Password123'

const startingServices = [
    { id: 'advising', name: 'Academic Advising', description: 'Advising', duration: 20, priority: 'Medium', isOpen: true },
    { id: 'financial-aid', name: 'Financial Aid', description: 'Aid', duration: 15, priority: 'High', isOpen: true },
    { id: 'it-help', name: 'IT Help Desk', description: 'IT', duration: 10, priority: 'Low', isOpen: false }
]

let passwordHash

beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4)
})

beforeEach(() => {
    clearQueueEntries()
    resetNotifications()
    services.splice(0, services.length, ...structuredClone(startingServices))
    db.prepare(`UPDATE queues SET status = ? WHERE service_id <> 'it-help'`).run('open')
    resetUsers([
        { id: 'alice-id', username: 'alice@email.com', passwordHash, role: 'user' },
        { id: 'bob-id', username: 'bob@email.com', passwordHash, role: 'user' }
    ])
})

async function loginAs(username) {
    const agent = request.agent(app)
    const response = await agent.post('/api/auth/login').send({ username, password: PASSWORD })
    expect(response.status).toBe(200)
    return agent
}

const rawRow = id => db.prepare('SELECT * FROM queue_entries WHERE entry_id = ?').get(id)

describe('Persistence - joining', () => {
    test('a join is saved as a waiting row linked to the service queue', () => {
        const before = Date.now()
        const { entry } = joinQueue('alice-id', 'advising')

        expect(rawRow(entry.id)).toMatchObject({
            entry_id: entry.id,
            queue_id: 'queue-advising',
            user_id: 'alice-id',
            priority: 'Medium',
            status: 'waiting',
            ended_at: null
        })
        expect(rawRow(entry.id).joined_at).toBeGreaterThanOrEqual(before)
        expect(rawRow(entry.id).joined_at).toBe(entry.joinedAt)
    })

    test('the username comes from the saved account email', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        expect(entry.username).toBe('alice@email.com')
        expect(getEntryById(entry.id).username).toBe('alice@email.com')
    })

    test('the entry is read back from the database, not from memory', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        db.prepare('UPDATE queue_entries SET priority = ? WHERE entry_id = ?').run('High', entry.id)

        expect(getEntryById(entry.id).priority).toBe('High')
        expect(findWaitingEntry('alice-id', 'advising').priority).toBe('High')
    })

    test('getEntryById returns undefined for an unknown id', () => {
        expect(getEntryById('missing')).toBeUndefined()
    })

    test('a closed queue row blocks joining even if the cached service says open', () => {
        db.prepare(`UPDATE queues SET status = 'closed' WHERE service_id = 'advising'`).run()

        expect(joinQueue('alice-id', 'advising').code).toBe('closed')
        expect(getAllEntries()).toHaveLength(0)
    })

    test('an unknown user id is rejected instead of crashing', () => {
        const result = joinQueue('ghost-id', 'advising')

        expect(result.code).toBe('not-found')
        expect(getAllEntries()).toHaveLength(0)
    })

    test('the database itself refuses a second waiting row for the same user and queue', () => {
        joinQueue('alice-id', 'advising')

        expect(() => insertEntry({
            id: 'dup', userId: 'alice-id', serviceId: 'advising', joinedAt: Date.now()
        })).toThrow(/UNIQUE/i)
    })

    test('the database refuses bad field values', () => {
        const bad = values => () => db.prepare(`
            INSERT INTO queue_entries (entry_id, queue_id, user_id, priority, joined_at, ended_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(...values)

        expect(bad(['x1', 'queue-advising', 'alice-id', 'Urgent', 1, null, 'waiting'])).toThrow()
        expect(bad(['x2', 'queue-advising', 'alice-id', 'High', 1, null, 'bogus'])).toThrow()
        expect(bad(['x3', 'queue-advising', 'alice-id', 'High', 1, null, 'served'])).toThrow()
        expect(bad(['x4', 'queue-advising', 'alice-id', 'High', 1, 5, 'waiting'])).toThrow()
        expect(bad(['x5', 'no-such-queue', 'alice-id', 'High', 1, null, 'waiting'])).toThrow()
    })
})

describe('Persistence - leaving, serving and timestamps', () => {
    test("leaving is stored as the schema's 'canceled' status with an end time", () => {
        const { entry } = joinQueue('alice-id', 'advising')
        const result = leaveQueue('alice-id', entry.id)

        expect(result.entry.status).toBe('left')
        expect(getStoredStatus(entry.id)).toBe('canceled')
        expect(rawRow(entry.id).ended_at).toBe(result.entry.endedAt)
        expect(rawRow(entry.id).ended_at).toBeGreaterThanOrEqual(entry.joinedAt)
        expect(getEntryById(entry.id).status).toBe('left')
    })

    test('serving is stored with the served status and the given end time', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        endEntry(entry, 'served', 12345)

        expect(rawRow(entry.id)).toMatchObject({ status: 'served', ended_at: 12345 })
    })

    test('being removed is stored as removed', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        endEntry(entry, 'removed', 777)

        expect(rawRow(entry.id)).toMatchObject({ status: 'removed', ended_at: 777 })
    })

    test('an entry ended earlier is not overwritten by a stale copy, and nobody is notified', () => {
        const { entry } = joinQueue('alice-id', 'advising')
        const stale = { ...entry }
        endEntry(entry, 'served', 1000)
        const sent = getAllNotifications().length

        const result = endEntry(stale, 'left', 2000)

        expect(result).toMatchObject({ status: 'served', endedAt: 1000 })
        expect(rawRow(entry.id)).toMatchObject({ status: 'served', ended_at: 1000 })
        expect(getAllNotifications()).toHaveLength(sent)
    })

    test('rejects an end time that is not a number', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        expect(() => endEntry(entry, 'served', 'soon')).toThrow()
        expect(rawRow(entry.id).status).toBe('waiting')
    })

    test('leaveQueue ignores a non-string entry id', () => {
        expect(leaveQueue('alice-id', { id: 'x' }).code).toBe('not-found')
        expect(leaveQueue('alice-id', undefined).code).toBe('not-found')
    })

    test('leaving then rejoining stores two rows: one ended, one waiting', () => {
        const first = joinQueue('alice-id', 'advising').entry
        leaveQueue('alice-id', first.id)
        const second = joinQueue('alice-id', 'advising').entry

        expect(getAllEntries().map(entry => [entry.id, entry.status]))
            .toEqual([[first.id, 'left'], [second.id, 'waiting']])
    })

    test('status names map both ways and unknown names pass through', () => {
        expect(toDbStatus('left')).toBe('canceled')
        expect(fromDbStatus('canceled')).toBe('left')
        expect(toDbStatus('served')).toBe('served')
        expect(fromDbStatus('removed')).toBe('removed')
    })
})

describe('Persistence - reads', () => {
    test('active entries are the waiting rows, oldest join first', () => {
        insertEntry({ id: 'newer', userId: 'alice-id', serviceId: 'financial-aid', joinedAt: 2000 })
        insertEntry({ id: 'older', userId: 'alice-id', serviceId: 'advising', joinedAt: 1000 })
        insertEntry({ id: 'done', userId: 'alice-id', serviceId: 'advising', joinedAt: 500, endedAt: 900, status: 'served' })

        expect(getUserActiveEntries('alice-id').map(entry => entry.id)).toEqual(['older', 'newer'])
    })

    test('history is the ended rows, most recently ended first, with left shown as left', () => {
        insertEntry({ id: 'a', userId: 'alice-id', joinedAt: 100, endedAt: 200, status: 'served' })
        insertEntry({ id: 'b', userId: 'alice-id', serviceId: 'financial-aid', joinedAt: 150, endedAt: 400, status: 'left' })
        insertEntry({ id: 'c', userId: 'alice-id', serviceId: 'it-help', joinedAt: 120, endedAt: 300, status: 'removed' })
        insertEntry({ id: 'w', userId: 'alice-id', serviceId: 'advising', joinedAt: 500 })

        expect(getUserHistory('alice-id').map(entry => [entry.id, entry.status]))
            .toEqual([['b', 'left'], ['c', 'removed'], ['a', 'served']])
    })

    test('recently served uses the window boundaries on the stored end time', () => {
        const now = 10_000_000
        insertEntry({ id: 'inside', userId: 'alice-id', joinedAt: 1, endedAt: now - RECENTLY_SERVED_WINDOW_MS, status: 'served' })
        insertEntry({ id: 'outside', userId: 'alice-id', serviceId: 'financial-aid', joinedAt: 1, endedAt: now - RECENTLY_SERVED_WINDOW_MS - 1, status: 'served' })
        insertEntry({ id: 'future', userId: 'alice-id', serviceId: 'it-help', joinedAt: 1, endedAt: now + 1, status: 'served' })

        expect(getRecentlyServed('alice-id', now).map(entry => entry.id)).toEqual(['inside'])
    })

    test('one user never sees another user\'s rows', () => {
        insertEntry({ id: 'bobs', userId: 'bob-id', joinedAt: 1, endedAt: 2, status: 'served' })

        expect(getUserHistory('alice-id')).toEqual([])
        expect(getRecentlyServed('alice-id', 3)).toEqual([])
        expect(getUserActiveEntries('alice-id')).toEqual([])
    })
})

describe('Persistence - through the API', () => {
    test('join, status and history all come from saved rows', async () => {
        const alice = await loginAs('alice@email.com')

        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        expect(joined.status).toBe(201)
        expect(rawRow(joined.body.entry.id)).toBeTruthy()

        const mine = await alice.get('/api/queues/mine')
        expect(mine.body.entries.map(entry => entry.id)).toEqual([joined.body.entry.id])

        const left = await alice.post(`/api/queues/${joined.body.entry.id}/leave`)
        expect(left.status).toBe(200)
        expect(getStoredStatus(joined.body.entry.id)).toBe('canceled')

        const history = await alice.get('/api/history')
        expect(history.body.history).toHaveLength(1)
        expect(history.body.history[0]).toMatchObject({
            id: joined.body.entry.id,
            serviceName: 'Academic Advising',
            status: 'left',
            outcome: 'Left queue'
        })
    })

    test('rows written directly to the database show up in the API (data survives restarts)', async () => {
        insertEntry({ id: 'saved-1', userId: 'alice-id', serviceId: 'advising', joinedAt: 1000 })
        insertEntry({ id: 'saved-2', userId: 'alice-id', serviceId: 'financial-aid', joinedAt: 500, endedAt: 900, status: 'served' })
        const alice = await loginAs('alice@email.com')

        const mine = await alice.get('/api/queues/mine')
        const history = await alice.get('/api/history')

        expect(mine.body.entries.map(entry => entry.id)).toEqual(['saved-1'])
        expect(history.body.history.map(entry => entry.id)).toEqual(['saved-2'])
        expect(history.body.history[0]).toMatchObject({ joinedAt: 500, endedAt: 900, outcome: 'Served' })
    })

    test('the summary reflects saved waiting rows', async () => {
        insertEntry({ id: 's1', userId: 'alice-id', serviceId: 'advising', joinedAt: 1 })
        insertEntry({ id: 's2', userId: 'bob-id', serviceId: 'advising', joinedAt: 2 })
        const alice = await loginAs('alice@email.com')

        const summary = (await alice.get('/api/queues/summary')).body.queues
        expect(summary.find(item => item.serviceId === 'advising')).toMatchObject({ waiting: 2, estimatedWait: 40 })
    })

    test('a user cannot leave another user\'s saved entry', async () => {
        insertEntry({ id: 'bobs-entry', userId: 'bob-id', serviceId: 'advising', joinedAt: 1 })
        const alice = await loginAs('alice@email.com')

        const response = await alice.post('/api/queues/bobs-entry/leave')

        expect(response.status).toBe(404)
        expect(rawRow('bobs-entry').status).toBe('waiting')
    })
})
