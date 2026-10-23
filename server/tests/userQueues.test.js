import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'

import app from '../src/app.js'
import { users } from '../src/data/usersData.js'
import { services } from '../src/data/servicesData.js'
import { notifications } from '../src/data/notificationData.js'
import {
    queueEntries,
    joinQueue,
    leaveQueue,
    endEntry,
    getWaitingEntriesForService,
    getQueue,
    serveNext,
    getPosition,
    estimateWaitMinutes,
    getQueueStage,
    getQueueSummary,
    toActiveEntryView,
    getUserActiveEntries,
    getRecentlyServed,
    MAX_SERVICE_ID_LENGTH,
    RECENTLY_SERVED_WINDOW_MS
} from '../src/data/queueData.js'

const PASSWORD = 'Password123'

const startingServices = [
    { id: 'advising', name: 'Academic Advising', description: 'Advising', duration: 20, priority: 'Medium', isOpen: true },
    { id: 'financial-aid', name: 'Financial Aid', description: 'Aid', duration: 15, priority: 'High', isOpen: true },
    { id: 'it-help', name: 'IT Help Desk', description: 'IT', duration: 10, priority: 'Low', isOpen: false }
]

let passwordHash

beforeAll(async () => {
    // Low cost factor keeps the test suite fast
    passwordHash = await bcrypt.hash(PASSWORD, 4)
})

beforeEach(() => {
    queueEntries.length = 0
    notifications.length = 0
    services.splice(0, services.length, ...structuredClone(startingServices))
    users.length = 0
    users.push(
        { id: 'alice-id', username: 'alice@email.com', passwordHash, role: 'user' },
        { id: 'bob-id', username: 'bob@email.com', passwordHash, role: 'user' },
        { id: 'admin-id', username: 'admin@email.com', passwordHash, role: 'admin' }
    )
})

const messagesFor = userId =>
    notifications.filter(note => note.userId === userId).map(note => note.message)

async function loginAs(username) {
    const agent = request.agent(app)
    const response = await agent.post('/api/auth/login').send({ username, password: PASSWORD })
    expect(response.status).toBe(200)
    return agent
}

// ---------------------------------------------------------------------------
// Business logic (no HTTP)
// ---------------------------------------------------------------------------

describe('Queue data - joining', () => {
    test('creates a waiting entry at the back of the queue', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        expect(entry).toMatchObject({
            userId: 'alice-id',
            serviceId: 'advising',
            priority: 'Medium',
            status: 'waiting',
            endedAt: null
        })
        expect(entry.id).toBeTruthy()
        expect(entry.joinedAt).toEqual(expect.any(Number))
        expect(queueEntries).toContain(entry)
    })

    test.each([undefined, null, '', '   ', 42, {}, ['advising']])(
        'rejects an invalid serviceId (%j)',
        (serviceId) => {
            const result = joinQueue('alice-id', serviceId)
            expect(result.code).toBe('invalid')
            expect(queueEntries).toHaveLength(0)
        }
    )

    test('rejects a serviceId over the length limit', () => {
        const result = joinQueue('alice-id', 'a'.repeat(MAX_SERVICE_ID_LENGTH + 1))

        expect(result.code).toBe('invalid')
        expect(result.error).toContain(String(MAX_SERVICE_ID_LENGTH))
        expect(queueEntries).toHaveLength(0)
    })

    test('accepts a serviceId exactly at the length limit (then fails as unknown, not invalid)', () => {
        expect(joinQueue('alice-id', 'a'.repeat(MAX_SERVICE_ID_LENGTH)).code).toBe('not-found')
    })

    test('rejects an unknown service', () => {
        expect(joinQueue('alice-id', 'does-not-exist').code).toBe('not-found')
        expect(queueEntries).toHaveLength(0)
    })

    test('rejects a closed service', () => {
        expect(joinQueue('alice-id', 'it-help').code).toBe('closed')
        expect(queueEntries).toHaveLength(0)
    })

    test('rejects joining the same queue twice', () => {
        joinQueue('alice-id', 'advising')
        const second = joinQueue('alice-id', 'advising')

        expect(second.code).toBe('duplicate')
        expect(queueEntries).toHaveLength(1)
    })

    test('lets a user wait in several different queues at once', () => {
        expect(joinQueue('alice-id', 'advising').entry).toBeDefined()
        expect(joinQueue('alice-id', 'financial-aid').entry).toBeDefined()
        expect(getUserActiveEntries('alice-id')).toHaveLength(2)
    })

    test('lets a user rejoin after leaving', () => {
        const { entry } = joinQueue('alice-id', 'advising')
        leaveQueue('alice-id', entry.id)

        const rejoin = joinQueue('alice-id', 'advising')
        expect(rejoin.entry).toBeDefined()
        expect(rejoin.entry.id).not.toBe(entry.id)
    })
})

describe('Queue data - position and wait time', () => {
    test('positions follow arrival order within one service', () => {
        const a = joinQueue('alice-id', 'advising').entry
        const b = joinQueue('bob-id', 'advising').entry

        expect(getPosition(a)).toBe(1)
        expect(getPosition(b)).toBe(2)
    })

    test('queues for different services do not affect each other', () => {
        joinQueue('alice-id', 'advising')
        const bobAid = joinQueue('bob-id', 'financial-aid').entry

        expect(getPosition(bobAid)).toBe(1)
        expect(getWaitingEntriesForService('advising')).toHaveLength(1)
        expect(getWaitingEntriesForService('financial-aid')).toHaveLength(1)
    })

    test('positions move up when someone ahead leaves', () => {
        const a = joinQueue('alice-id', 'advising').entry
        const b = joinQueue('bob-id', 'advising').entry

        leaveQueue('alice-id', a.id)

        expect(getPosition(a)).toBeNull()
        expect(getPosition(b)).toBe(1)
    })

    test('positions move up when an admin serves the person ahead', () => {
        const a = joinQueue('alice-id', 'advising').entry
        const b = joinQueue('bob-id', 'advising').entry

        endEntry(a, 'served')

        expect(getPosition(b)).toBe(1)
    })

    test('estimated wait is (people ahead) x service duration', () => {
        const service = { duration: 20 }

        expect(estimateWaitMinutes(1, service)).toBe(0)
        expect(estimateWaitMinutes(2, service)).toBe(20)
        expect(estimateWaitMinutes(4, service)).toBe(60)
    })

    test.each([
        [0, { duration: 20 }],
        [-1, { duration: 20 }],
        [1.5, { duration: 20 }],
        [null, { duration: 20 }],
        [3, undefined]
    ])('estimated wait falls back to 0 for bad input (%j)', (position, service) => {
        expect(estimateWaitMinutes(position, service)).toBe(0)
    })

    test('stage is "almost-ready" only for position 1', () => {
        expect(getQueueStage(1)).toBe('almost-ready')
        expect(getQueueStage(2)).toBe('waiting')
        expect(getQueueStage(null)).toBe('waiting')
    })

    test('summary reports the waiting count and the wait for a new joiner', () => {
        joinQueue('alice-id', 'advising')
        joinQueue('bob-id', 'advising')

        const summary = getQueueSummary()

        expect(summary.find(item => item.serviceId === 'advising')).toEqual({
            serviceId: 'advising',
            waiting: 2,
            estimatedWait: 40
        })
        expect(summary.find(item => item.serviceId === 'financial-aid')).toEqual({
            serviceId: 'financial-aid',
            waiting: 0,
            estimatedWait: 0
        })
    })
})

describe('Queue data - leaving and ending entries', () => {
    test('leaving marks the entry as left with an end time', () => {
        const { entry } = joinQueue('alice-id', 'advising')
        const result = leaveQueue('alice-id', entry.id)

        expect(result.entry.status).toBe('left')
        expect(result.entry.endedAt).toEqual(expect.any(Number))
    })

    test('cannot leave an unknown entry', () => {
        expect(leaveQueue('alice-id', 'nope').code).toBe('not-found')
    })

    test("cannot leave someone else's entry", () => {
        const { entry } = joinQueue('alice-id', 'advising')

        expect(leaveQueue('bob-id', entry.id).code).toBe('not-found')
        expect(entry.status).toBe('waiting')
    })

    test('cannot leave an entry that already ended', () => {
        const { entry } = joinQueue('alice-id', 'advising')
        leaveQueue('alice-id', entry.id)

        expect(leaveQueue('alice-id', entry.id).code).toBe('not-active')
    })

    test('endEntry only accepts ended statuses', () => {
        const { entry } = joinQueue('alice-id', 'advising')

        expect(() => endEntry(entry, 'waiting')).toThrow()
        expect(() => endEntry(entry, 'bogus')).toThrow()
        expect(entry.status).toBe('waiting')
    })
})

describe('Queue data - ended entries are protected', () => {
    test('ending an entry that already ended changes nothing and sends nothing', () => {
        const { entry } = joinQueue('alice-id', 'advising')
        endEntry(entry, 'served', 1000)
        const notificationsAfterServe = notifications.length

        endEntry(entry, 'left', 2000)

        expect(entry.status).toBe('served')
        expect(entry.endedAt).toBe(1000)
        expect(notifications).toHaveLength(notificationsAfterServe)
    })
})

describe('Queue data - notifications', () => {
    test('joining notifies the joiner with their position', () => {
        joinQueue('alice-id', 'advising')
        joinQueue('bob-id', 'advising')

        expect(messagesFor('alice-id')).toEqual(['You joined the Academic Advising queue. Your current position is 1.'])
        expect(messagesFor('bob-id')).toEqual(['You joined the Academic Advising queue. Your current position is 2.'])
    })

    test('notifications use the shared notification shape', () => {
        joinQueue('alice-id', 'advising')

        expect(notifications[0]).toEqual({
            id: expect.any(String),
            userId: 'alice-id',
            message: expect.any(String),
            timestamp: expect.any(String),
            read: false
        })
        expect(Number.isNaN(Date.parse(notifications[0].timestamp))).toBe(false)
    })

    test('a failed join sends no notification', () => {
        joinQueue('alice-id', 'it-help')
        joinQueue('alice-id', 'does-not-exist')

        expect(notifications).toHaveLength(0)
    })

    test('leaving notifies the leaver', () => {
        const { entry } = joinQueue('alice-id', 'advising')
        leaveQueue('alice-id', entry.id)

        expect(messagesFor('alice-id')).toContain('You have left the Academic Advising queue.')
    })

    test('when someone leaves, the person right behind gets the "you\'re next" alert', () => {
        const a = joinQueue('alice-id', 'advising').entry
        joinQueue('bob-id', 'advising')

        leaveQueue('alice-id', a.id)

        expect(messagesFor('bob-id')).toContain("You're next in the Academic Advising queue. Please be ready.")
    })

    test('people further back are told their new position, people ahead are not notified', () => {
        users.push({ id: 'carol-id', username: 'carol@email.com', passwordHash, role: 'user' })
        joinQueue('alice-id', 'advising')
        const b = joinQueue('bob-id', 'advising').entry
        joinQueue('carol-id', 'advising')
        const beforeLeave = notifications.length

        leaveQueue('bob-id', b.id)

        const newOnes = notifications.slice(beforeLeave)
        expect(newOnes.map(note => note.userId).sort()).toEqual(['bob-id', 'carol-id'])
        expect(messagesFor('carol-id')).toContain(
            'Your position in the Academic Advising queue has changed. Your new position is 2.'
        )
        expect(messagesFor('alice-id')).toHaveLength(1) // only her original "joined" message
    })

    test('serving the first person notifies them and alerts the next in line', () => {
        const a = joinQueue('alice-id', 'advising').entry
        joinQueue('bob-id', 'advising')

        endEntry(a, 'served')

        expect(messagesFor('alice-id')).toContain('You have been served at Academic Advising.')
        expect(messagesFor('bob-id')).toContain("You're next in the Academic Advising queue. Please be ready.")
    })

    test('being removed by staff notifies the user', () => {
        const a = joinQueue('alice-id', 'advising').entry

        endEntry(a, 'removed')

        expect(messagesFor('alice-id')).toContain('You were removed from the Academic Advising queue by staff.')
    })

    test('other services\' queues are never notified', () => {
        const a = joinQueue('alice-id', 'advising').entry
        joinQueue('bob-id', 'financial-aid')
        const beforeLeave = notifications.length

        leaveQueue('alice-id', a.id)

        expect(notifications.slice(beforeLeave).map(note => note.userId)).toEqual(['alice-id'])
    })
})

describe('Queue data - recently served', () => {
    const now = 10_000_000
    const minutesAgo = minutes => now - minutes * 60 * 1000

    function servedEntry(userId, endedAt, status = 'served') {
        const { entry } = joinQueue(userId, 'advising')
        endEntry(entry, status, endedAt)
        return entry
    }

    test('includes entries served inside the window, newest first', () => {
        const older = servedEntry('alice-id', minutesAgo(10))
        const newer = servedEntry('alice-id', minutesAgo(2))

        expect(getRecentlyServed('alice-id', now).map(entry => entry.id)).toEqual([newer.id, older.id])
    })

    test('excludes entries served before the window', () => {
        servedEntry('alice-id', now - RECENTLY_SERVED_WINDOW_MS - 1000)

        expect(getRecentlyServed('alice-id', now)).toEqual([])
    })

    test('excludes left and removed entries', () => {
        servedEntry('alice-id', minutesAgo(1), 'left')
        servedEntry('alice-id', minutesAgo(1), 'removed')

        expect(getRecentlyServed('alice-id', now)).toEqual([])
    })

    test("excludes other users' entries", () => {
        servedEntry('bob-id', minutesAgo(1))

        expect(getRecentlyServed('alice-id', now)).toEqual([])
    })
})

describe('Queue data - shared entry contract (user + admin modules)', () => {
    test('joining records the username and the service priority at join time', () => {
        const { entry } = joinQueue('alice-id', 'advising', 'alice@email.com')

        expect(entry.username).toBe('alice@email.com')
        expect(entry.priority).toBe('Medium')
    })

    test('a later joiner of a higher-priority service is placed ahead of earlier lower-priority entries', () => {
        const medium = joinQueue('alice-id', 'advising', 'alice@email.com').entry
        services.find(service => service.id === 'advising').priority = 'High'
        const high = joinQueue('bob-id', 'advising', 'bob@email.com').entry

        expect(medium.priority).toBe('Medium') // earlier entries keep the priority they joined with
        expect(getPosition(high)).toBe(1)
        expect(getPosition(medium)).toBe(2)
    })

    test('Low priority entries wait behind Medium even if they arrived first', () => {
        services.find(service => service.id === 'advising').priority = 'Low'
        const low = joinQueue('alice-id', 'advising').entry
        services.find(service => service.id === 'advising').priority = 'Medium'
        const medium = joinQueue('bob-id', 'advising').entry

        expect(getPosition(medium)).toBe(1)
        expect(getPosition(low)).toBe(2)
    })

    test('equal-priority entries are served in arrival order', () => {
        const first = joinQueue('alice-id', 'advising').entry
        const second = joinQueue('bob-id', 'advising').entry

        expect(getWaitingEntriesForService('advising').map(entry => entry.id)).toEqual([first.id, second.id])
    })

    test("each user's wait matches the admin queue's per-visitor wait for the same queue", () => {
        users.push({ id: 'carol-id', username: 'carol@email.com', passwordHash, role: 'user' })
        const entries = ['alice-id', 'bob-id', 'carol-id'].map(id => joinQueue(id, 'advising').entry)
        const adminView = getQueue(services.find(service => service.id === 'advising')).queue

        entries.forEach(entry => {
            const adminWait = adminView.find(item => item.id === entry.id).estimatedWaitMinutes
            expect(toActiveEntryView(entry).estimatedWait).toBe(adminWait)
        })
    })

    test('the summary agrees with the admin queue totals', () => {
        joinQueue('alice-id', 'advising')
        joinQueue('bob-id', 'advising')
        const adminQueue = getQueue(services.find(service => service.id === 'advising'))

        expect(getQueueSummary().find(item => item.serviceId === 'advising')).toEqual({
            serviceId: 'advising',
            waiting: adminQueue.queueLength,
            estimatedWait: adminQueue.estimatedWaitMinutes
        })
    })

    test('admin "serve next" notifies the served user and alerts the next in line', () => {
        const first = joinQueue('alice-id', 'advising').entry
        joinQueue('bob-id', 'advising')

        const served = serveNext('advising')

        expect(served.id).toBe(first.id)
        expect(served).toMatchObject({ status: 'served', endedAt: expect.any(Number) })
        expect(messagesFor('alice-id')).toContain('You have been served at Academic Advising.')
        expect(messagesFor('bob-id')).toContain("You're next in the Academic Advising queue. Please be ready.")
    })

    test('serving an empty queue returns null and notifies nobody', () => {
        expect(serveNext('advising')).toBeNull()
        expect(notifications).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------------

describe('Queue routes - access control', () => {
    test.each([
        ['get', '/api/queues/summary'],
        ['get', '/api/queues/mine'],
        ['post', '/api/queues/join'],
        ['post', '/api/queues/some-id/leave']
    ])('%s %s requires a login', async (method, path) => {
        const response = await request(app)[method](path)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Authentication required')
    })

    test.each([
        ['get', '/api/queues/mine'],
        ['post', '/api/queues/join'],
        ['post', '/api/queues/some-id/leave']
    ])('admins cannot use %s %s', async (method, path) => {
        const admin = await loginAs('admin@email.com')
        const response = await admin[method](path).send({ serviceId: 'advising' })

        expect(response.status).toBe(403)
        expect(response.body.error).toBe('User access required')
        expect(queueEntries).toHaveLength(0)
    })

    test('admins can still read the queue summary', async () => {
        const admin = await loginAs('admin@email.com')
        const response = await admin.get('/api/queues/summary')

        expect(response.status).toBe(200)
    })
})

describe('Queue routes - POST /api/queues/join', () => {
    test('joins a queue and returns position, wait and stage', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        expect(response.status).toBe(201)
        expect(response.body.entry).toMatchObject({
            serviceId: 'advising',
            serviceName: 'Academic Advising',
            priority: 'Medium',
            duration: 20,
            status: 'waiting',
            position: 1,
            estimatedWait: 0,
            stage: 'almost-ready'
        })
        expect(queueEntries).toHaveLength(1)
        expect(queueEntries[0].userId).toBe('alice-id')
    })

    test('does not leak internal fields such as userId', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        expect(response.body.entry.userId).toBeUndefined()
    })

    test('a second user lands behind the first with a longer wait', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')

        await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        const response = await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        expect(response.status).toBe(201)
        expect(response.body.entry).toMatchObject({
            position: 2,
            estimatedWait: 20,
            stage: 'waiting'
        })
    })

    test('uses the logged-in user, not an id from the request body', async () => {
        const alice = await loginAs('alice@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising', userId: 'bob-id' })

        expect(queueEntries[0].userId).toBe('alice-id')
    })

    test.each([
        [{}, 400],
        [{ serviceId: '' }, 400],
        [{ serviceId: 123 }, 400],
        [{ serviceId: 'does-not-exist' }, 404],
        [{ serviceId: 'it-help' }, 409]
    ])('rejects bad join requests (%j -> %i)', async (body, status) => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.post('/api/queues/join').send(body)

        expect(response.status).toBe(status)
        expect(response.body.error).toBeTruthy()
        expect(queueEntries).toHaveLength(0)
    })

    test('rejects an over-long serviceId with 400', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.post('/api/queues/join').send({ serviceId: 'x'.repeat(MAX_SERVICE_ID_LENGTH + 1) })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain(String(MAX_SERVICE_ID_LENGTH))
    })

    test('rejects a request with no body at all', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.post('/api/queues/join')

        expect(response.status).toBe(400)
    })

    test('rejects joining the same queue twice', async () => {
        const alice = await loginAs('alice@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        const response = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        expect(response.status).toBe(409)
        expect(response.body.error).toBe('You are already in this queue')
        expect(queueEntries).toHaveLength(1)
    })
})

describe('Queue routes - GET /api/queues/mine', () => {
    test('is empty when the user has not joined anything', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.get('/api/queues/mine')

        expect(response.status).toBe(200)
        expect(response.body.entries).toEqual([])
    })

    test("lists only the user's own active queues", async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')

        await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'financial-aid' })

        const aliceResponse = await alice.get('/api/queues/mine')
        const bobResponse = await bob.get('/api/queues/mine')

        expect(aliceResponse.body.entries).toHaveLength(1)
        expect(aliceResponse.body.entries[0]).toMatchObject({ serviceId: 'advising', position: 1 })
        expect(bobResponse.body.entries.map(entry => entry.serviceId)).toEqual(['advising', 'financial-aid'])
        expect(bobResponse.body.entries[0].position).toBe(2)
    })

    test('reflects queue changes made on the admin side (shared data)', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        // Simulates the admin portal serving the first person in line
        endEntry(getWaitingEntriesForService('advising')[0], 'served')

        const aliceResponse = await alice.get('/api/queues/mine')
        const bobResponse = await bob.get('/api/queues/mine')

        expect(aliceResponse.body.entries).toEqual([])
        expect(bobResponse.body.entries[0]).toMatchObject({ position: 1, estimatedWait: 0, stage: 'almost-ready' })
    })
})

describe('Queue routes - served status and notifications', () => {
    test('/mine reports a just-served queue as "served" and drops it from active entries', async () => {
        const alice = await loginAs('alice@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        // Simulates the admin portal pressing "Serve next"
        endEntry(getWaitingEntriesForService('advising')[0], 'served')

        const response = await alice.get('/api/queues/mine')

        expect(response.body.entries).toEqual([])
        expect(response.body.recentlyServed).toEqual([
            {
                id: joined.body.entry.id,
                serviceId: 'advising',
                serviceName: 'Academic Advising',
                servedAt: expect.any(Number),
                status: 'served',
                stage: 'served'
            }
        ])
    })

    test('/mine has an empty recentlyServed list when nothing was served', async () => {
        const alice = await loginAs('alice@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        expect((await alice.get('/api/queues/mine')).body.recentlyServed).toEqual([])
    })

    test('joining creates a notification the notification route returns to that user', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        const aliceNotes = await alice.get('/api/notifications/get-notifications')
        const bobNotes = await bob.get('/api/notifications/get-notifications')

        expect(aliceNotes.status).toBe(200)
        expect(aliceNotes.body.notifications.map(note => note.message)).toContain(
            'You joined the Academic Advising queue. Your current position is 1.'
        )
        expect(bobNotes.body.notifications).toEqual([])
    })

    test('leaving alerts the next person in line through the notification route', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        await alice.post(`/api/queues/${joined.body.entry.id}/leave`)

        const bobNotes = await bob.get('/api/notifications/get-notifications')
        expect(bobNotes.body.notifications.map(note => note.message)).toContain(
            "You're next in the Academic Advising queue. Please be ready."
        )
    })
})

describe('Queue routes - POST /api/queues/:entryId/leave', () => {
    test('leaves a queue and moves everyone behind up', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        const response = await alice.post(`/api/queues/${joined.body.entry.id}/leave`)

        expect(response.status).toBe(200)
        expect((await alice.get('/api/queues/mine')).body.entries).toEqual([])
        expect((await bob.get('/api/queues/mine')).body.entries[0].position).toBe(1)
        expect(queueEntries.find(entry => entry.id === joined.body.entry.id).status).toBe('left')
    })

    test('returns 404 for an unknown entry', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.post('/api/queues/unknown-id/leave')

        expect(response.status).toBe(404)
    })

    test("returns 404 (not 403) for someone else's entry and leaves it untouched", async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        const response = await bob.post(`/api/queues/${joined.body.entry.id}/leave`)

        expect(response.status).toBe(404)
        expect(queueEntries[0].status).toBe('waiting')
    })

    test('returns 409 when leaving twice', async () => {
        const alice = await loginAs('alice@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await alice.post(`/api/queues/${joined.body.entry.id}/leave`)

        const response = await alice.post(`/api/queues/${joined.body.entry.id}/leave`)

        expect(response.status).toBe(409)
        expect(response.body.error).toBe('You are no longer in this queue')
    })
})

describe('Queue routes - GET /api/queues/summary', () => {
    test('reports waiting counts for every service', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        const response = await alice.get('/api/queues/summary')

        expect(response.status).toBe(200)
        expect(response.body.queues).toHaveLength(3)
        expect(response.body.queues.find(queue => queue.serviceId === 'advising')).toEqual({
            serviceId: 'advising',
            waiting: 2,
            estimatedWait: 40
        })
    })
})

describe('User and admin portals share one queue (end to end)', () => {
    test('a visitor who joins appears in the admin queue with username, priority and position', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        const admin = await loginAs('admin@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        const response = await admin.get('/api/queues')
        const advising = response.body.queues.find(queue => queue.id === 'advising')

        expect(response.status).toBe(200)
        expect(advising.queueLength).toBe(2)
        expect(advising.queue.map(visitor => [visitor.username, visitor.priority, visitor.position])).toEqual([
            ['alice@email.com', 'Medium', 1],
            ['bob@email.com', 'Medium', 2]
        ])
    })

    test('the admin wait-time endpoint matches what a new joiner is shown', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        const wait = await bob.get('/api/queues/advising/wait-time')
        const summary = await bob.get('/api/queues/summary')

        expect(wait.body.estimatedWaitMinutes).toBe(
            summary.body.queues.find(queue => queue.serviceId === 'advising').estimatedWait
        )
    })

    test('admin serve-next flows through to the user: status, history and notifications', async () => {
        const alice = await loginAs('alice@email.com')
        const bob = await loginAs('bob@email.com')
        const admin = await loginAs('admin@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await bob.post('/api/queues/join').send({ serviceId: 'advising' })

        const serve = await admin.post('/api/queues/advising/serve-next')

        expect(serve.status).toBe(200)
        expect(serve.body.servedEntry).toMatchObject({ id: joined.body.entry.id, username: 'alice@email.com', status: 'served' })

        // Alice: no longer waiting, shown as served, recorded in history
        const aliceStatus = (await alice.get('/api/queues/mine')).body
        expect(aliceStatus.entries).toEqual([])
        expect(aliceStatus.recentlyServed.map(entry => entry.id)).toEqual([joined.body.entry.id])
        const aliceHistory = (await alice.get('/api/history')).body.history
        expect(aliceHistory[0]).toMatchObject({ id: joined.body.entry.id, outcome: 'Served' })

        // Bob: moved to the front and told so
        const bobStatus = (await bob.get('/api/queues/mine')).body.entries[0]
        expect(bobStatus).toMatchObject({ position: 1, stage: 'almost-ready' })

        const aliceNotes = (await alice.get('/api/notifications/get-notifications')).body.notifications.map(note => note.message)
        const bobNotes = (await bob.get('/api/notifications/get-notifications')).body.notifications.map(note => note.message)
        expect(aliceNotes).toContain('You have been served at Academic Advising.')
        expect(bobNotes).toContain("You're next in the Academic Advising queue. Please be ready.")
    })

    test('a user who leaves disappears from the admin queue', async () => {
        const alice = await loginAs('alice@email.com')
        const admin = await loginAs('admin@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        await alice.post(`/api/queues/${joined.body.entry.id}/leave`)

        const advising = (await admin.get('/api/queues')).body.queues.find(queue => queue.id === 'advising')
        expect(advising.queueLength).toBe(0)
    })

    test('the join route stores the logged-in username on the entry', async () => {
        const alice = await loginAs('alice@email.com')
        await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        expect(queueEntries[0]).toMatchObject({ userId: 'alice-id', username: 'alice@email.com', priority: 'Medium' })
    })
})
