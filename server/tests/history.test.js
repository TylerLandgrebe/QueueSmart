import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'

import app from '../src/app.js'
import { users } from '../src/data/usersData.js'
import { services } from '../src/data/servicesData.js'
import {
    queueEntries,
    getUserHistory,
    toHistoryView,
    joinQueue,
    endEntry
} from '../src/data/queueData.js'

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
    queueEntries.length = 0
    services.splice(0, services.length, ...structuredClone(startingServices))
    users.length = 0
    users.push(
        { id: 'alice-id', username: 'alice@email.com', passwordHash, role: 'user' },
        { id: 'bob-id', username: 'bob@email.com', passwordHash, role: 'user' }
    )
})

async function loginAs(username) {
    const agent = request.agent(app)
    const response = await agent.post('/api/auth/login').send({ username, password: PASSWORD })
    expect(response.status).toBe(200)
    return agent
}

// Adds an entry straight to the shared store with fixed timestamps so
// ordering assertions are deterministic.
function addEntry({ id, userId = 'alice-id', serviceId = 'advising', status, joinedAt, endedAt = null }) {
    const entry = { id, userId, serviceId, status, joinedAt, endedAt }
    queueEntries.push(entry)
    return entry
}

describe('History data', () => {
    test('only includes the given user\'s ended entries', () => {
        addEntry({ id: 'a1', status: 'served', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:20:00.000Z') })
        addEntry({ id: 'a2', status: 'waiting', joinedAt: Date.parse('2026-10-02T10:00:00.000Z') })
        addEntry({ id: 'b1', userId: 'bob-id', status: 'served', joinedAt: Date.parse('2026-10-01T11:00:00.000Z'), endedAt: Date.parse('2026-10-01T11:20:00.000Z') })

        expect(getUserHistory('alice-id').map(entry => entry.id)).toEqual(['a1'])
        expect(getUserHistory('bob-id').map(entry => entry.id)).toEqual(['b1'])
    })

    test('is ordered most recently ended first', () => {
        addEntry({ id: 'old', status: 'served', joinedAt: Date.parse('2026-10-01T09:00:00.000Z'), endedAt: Date.parse('2026-10-01T09:30:00.000Z') })
        addEntry({ id: 'new', status: 'left', joinedAt: Date.parse('2026-10-03T09:00:00.000Z'), endedAt: Date.parse('2026-10-03T09:10:00.000Z') })
        addEntry({ id: 'mid', status: 'removed', joinedAt: Date.parse('2026-10-02T09:00:00.000Z'), endedAt: Date.parse('2026-10-02T09:05:00.000Z') })

        expect(getUserHistory('alice-id').map(entry => entry.id)).toEqual(['new', 'mid', 'old'])
    })

    test('breaks ties on end time by the most recent join', () => {
        const endedAt = Date.parse('2026-10-01T12:00:00.000Z')
        addEntry({ id: 'joined-early', status: 'left', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt })
        addEntry({ id: 'joined-late', serviceId: 'financial-aid', status: 'left', joinedAt: Date.parse('2026-10-01T11:00:00.000Z'), endedAt })

        expect(getUserHistory('alice-id').map(entry => entry.id)).toEqual(['joined-late', 'joined-early'])
    })

    test('returns an empty list when the user has no past queues', () => {
        expect(getUserHistory('alice-id')).toEqual([])
    })

    test.each([
        ['served', 'Served'],
        ['left', 'Left queue'],
        ['removed', 'Removed by staff']
    ])('labels a "%s" entry as "%s"', (status, outcome) => {
        const entry = addEntry({ id: 'e', status, joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:10:00.000Z') })

        expect(toHistoryView(entry)).toEqual({
            id: 'e',
            serviceId: 'advising',
            serviceName: 'Academic Advising',
            joinedAt: Date.parse('2026-10-01T10:00:00.000Z'),
            endedAt: Date.parse('2026-10-01T10:10:00.000Z'),
            status,
            outcome
        })
    })

    test('falls back to the raw status for an unrecognised outcome', () => {
        const entry = addEntry({ id: 'e', status: 'mystery', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:10:00.000Z') })

        expect(toHistoryView(entry).outcome).toBe('mystery')
    })

    test('shows "Unknown service" if the service no longer exists', () => {
        const entry = addEntry({ id: 'e', serviceId: 'removed-service', status: 'served', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:10:00.000Z') })

        expect(toHistoryView(entry).serviceName).toBe('Unknown service')
    })
})

describe('History route - GET /api/history', () => {
    test('requires a login', async () => {
        const response = await request(app).get('/api/history')

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Authentication required')
    })

    test('is empty for a user with no history', async () => {
        const alice = await loginAs('alice@email.com')
        const response = await alice.get('/api/history')

        expect(response.status).toBe(200)
        expect(response.body.history).toEqual([])
    })

    test('lists past queues with date, service name and outcome', async () => {
        addEntry({ id: 'a1', status: 'served', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:20:00.000Z') })
        addEntry({ id: 'a2', serviceId: 'financial-aid', status: 'left', joinedAt: Date.parse('2026-10-02T10:00:00.000Z'), endedAt: Date.parse('2026-10-02T10:05:00.000Z') })

        const alice = await loginAs('alice@email.com')
        const response = await alice.get('/api/history')

        expect(response.status).toBe(200)
        expect(response.body.history).toEqual([
            {
                id: 'a2',
                serviceId: 'financial-aid',
                serviceName: 'Financial Aid',
                joinedAt: Date.parse('2026-10-02T10:00:00.000Z'),
                endedAt: Date.parse('2026-10-02T10:05:00.000Z'),
                status: 'left',
                outcome: 'Left queue'
            },
            {
                id: 'a1',
                serviceId: 'advising',
                serviceName: 'Academic Advising',
                joinedAt: Date.parse('2026-10-01T10:00:00.000Z'),
                endedAt: Date.parse('2026-10-01T10:20:00.000Z'),
                status: 'served',
                outcome: 'Served'
            }
        ])
    })

    test('does not include queues the user is still waiting in', async () => {
        addEntry({ id: 'a1', status: 'waiting', joinedAt: Date.parse('2026-10-01T10:00:00.000Z') })

        const alice = await loginAs('alice@email.com')
        const response = await alice.get('/api/history')

        expect(response.body.history).toEqual([])
    })

    test("never shows another user's history", async () => {
        addEntry({ id: 'b1', userId: 'bob-id', status: 'served', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:20:00.000Z') })

        const alice = await loginAs('alice@email.com')
        const response = await alice.get('/api/history')

        expect(response.body.history).toEqual([])
    })

    test('does not expose user ids', async () => {
        addEntry({ id: 'a1', status: 'served', joinedAt: Date.parse('2026-10-01T10:00:00.000Z'), endedAt: Date.parse('2026-10-01T10:20:00.000Z') })

        const alice = await loginAs('alice@email.com')
        const response = await alice.get('/api/history')

        expect(response.body.history[0].userId).toBeUndefined()
    })
})

describe('History - queues ended by the admin side', () => {
    test('a queue the admin serves shows up as "Served"', async () => {
        const { entry } = joinQueue('alice-id', 'advising')
        endEntry(entry, 'served', Date.parse('2026-10-01T10:20:00.000Z'))

        const alice = await loginAs('alice@email.com')
        const history = (await alice.get('/api/history')).body.history

        expect(history).toHaveLength(1)
        expect(history[0]).toMatchObject({ id: entry.id, status: 'served', outcome: 'Served', endedAt: Date.parse('2026-10-01T10:20:00.000Z') })
    })

    test('a queue the admin removes shows up as "Removed by staff"', async () => {
        const { entry } = joinQueue('alice-id', 'advising')
        endEntry(entry, 'removed')

        const alice = await loginAs('alice@email.com')
        const history = (await alice.get('/api/history')).body.history

        expect(history[0]).toMatchObject({ status: 'removed', outcome: 'Removed by staff' })
    })
})

describe('History - end to end with the queue routes', () => {
    test('a queue the user leaves shows up in their history as "Left queue"', async () => {
        const alice = await loginAs('alice@email.com')
        const joined = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        // Still waiting, so nothing in history yet
        expect((await alice.get('/api/history')).body.history).toEqual([])

        await alice.post(`/api/queues/${joined.body.entry.id}/leave`)

        const history = (await alice.get('/api/history')).body.history
        expect(history).toHaveLength(1)
        expect(history[0]).toMatchObject({
            id: joined.body.entry.id,
            serviceName: 'Academic Advising',
            status: 'left',
            outcome: 'Left queue'
        })
        expect(history[0].endedAt).toEqual(expect.any(Number))
    })

    test('rejoining after leaving keeps the old entry in history and the new one active', async () => {
        const alice = await loginAs('alice@email.com')
        const first = await alice.post('/api/queues/join').send({ serviceId: 'advising' })
        await alice.post(`/api/queues/${first.body.entry.id}/leave`)
        const second = await alice.post('/api/queues/join').send({ serviceId: 'advising' })

        const history = (await alice.get('/api/history')).body.history
        const active = (await alice.get('/api/queues/mine')).body.entries

        expect(history.map(entry => entry.id)).toEqual([first.body.entry.id])
        expect(active.map(entry => entry.id)).toEqual([second.body.entry.id])
    })
})
