import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { services } from '../src/data/servicesData.js'
import db from '../src/db/database.js'
import { getAllNotifications, resetNotifications } from './helpers/notifications.js'
import { createUser } from '../src/data/usersData.js'
import { resetQueueEntries, insertEntry, getAllEntries } from './helpers/queueEntries.js'

const startingServices = structuredClone(services)
const admin = request.agent(app)
const user = request.agent(app)

beforeAll(async () => {
    // Visitors must exist so serving them can store their notifications
    createUser({ id: 'visitor-1', username: 'first@example.com', passwordHash: 'unused' })
    createUser({ id: 'visitor-2', username: 'urgent@example.com', passwordHash: 'unused' })


    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin@email.com', password: 'adminPass' })
    const userLogin = await user.post('/api/auth/login').send({ username: 'user@email.com', password: 'Password123' })
    expect(adminLogin.status).toBe(200)
    expect(userLogin.status).toBe(200)
})

beforeEach(() => {
    resetNotifications()
    services.splice(0, services.length, ...structuredClone(startingServices))
    resetQueueEntries([
        { id: 'first', userId: 'visitor-1', username: 'first@example.com', serviceId: 'advising', priority: 'Medium', joinedAt: 1000, endedAt: null, status: 'waiting' },
        { id: 'urgent', userId: 'visitor-2', username: 'urgent@example.com', serviceId: 'advising', priority: 'High', joinedAt: 2000, endedAt: null, status: 'waiting' },
    ])
})

describe('Admin queue APIs', () => {
    test.each([
        ['get', '/api/queues'],
        ['post', '/api/queues/advising/serve-next'],
        ['post', '/api/queues/advising/entries/urgent/remove'],
    ])('requires a session for %s %s', async (method, path) => {
        const response = await request(app)[method](path)

        expect(response.status).toBe(401)
        expect(getAllEntries().every(entry => entry.status === 'waiting')).toBe(true)
    })

    test.each([
        ['get', '/api/queues'],
        ['post', '/api/queues/advising/serve-next'],
        ['post', '/api/queues/advising/entries/urgent/remove'],
    ])('rejects a regular user for %s %s', async (method, path) => {
        const response = await user[method](path)

        expect(response.status).toBe(403)
        expect(getAllEntries().every(entry => entry.status === 'waiting')).toBe(true)
    })

    test('lists every service with server-derived counts and wait estimates', async () => {
        const response = await admin.get('/api/queues')

        expect(response.status).toBe(200)
        expect(response.body.queues).toHaveLength(startingServices.length)
        expect(response.body.queues[0]).toMatchObject({ id: 'advising', queueLength: 2, estimatedWaitMinutes: 40 })
        expect(response.body.queues[1]).toMatchObject({ queue: [], queueLength: 0, estimatedWaitMinutes: 0 })
    })

    test('serves the first waiting visitor and returns the updated queue', async () => {
        const response = await admin.post('/api/queues/advising/serve-next')

        expect(response.status).toBe(200)
        expect(response.body.servedEntry).toMatchObject({ id: 'urgent', status: 'served', endedAt: expect.any(Number) })
        expect(response.body.queue).toMatchObject({ queueLength: 1, estimatedWaitMinutes: 20 })
        expect(response.body.queue.queue[0]).toMatchObject({ id: 'first', position: 1, estimatedWaitMinutes: 0 })
        expect(getAllEntries().find(entry => entry.id === 'urgent').status).toBe('served')
    })

    test('allows staff to drain a closed queue while it stops accepting visitors', async () => {
        services[0].isOpen = false

        const response = await admin.post('/api/queues/advising/serve-next')

        expect(response.status).toBe(200)
        expect(response.body.queue.isOpen).toBe(false)
    })

    test('returns a conflict when no visitors are waiting', async () => {
        const response = await admin.post('/api/queues/financial-aid/serve-next')

        expect(response.status).toBe(409)
        expect(response.body.error).toBe('Queue is empty')
    })

    test('returns 404 when serving an unknown service', async () => {
        const response = await admin.post('/api/queues/missing/serve-next')

        expect(response.status).toBe(404)
        expect(response.body.error).toBe('Service not found')
    })

    test.each(['bad%20id', 'a'.repeat(101), '%2F'])('rejects an invalid service ID: %s', async (serviceId) => {
        const response = await admin.post(`/api/queues/${serviceId}/serve-next`)

        expect(response.status).toBe(400)
        expect(getAllEntries().every(entry => entry.status === 'waiting')).toBe(true)
    })

    test.each([[[]], [{ entryId: 'first' }], [{ status: 'served' }]])('rejects unsupported serve-next input: %j', async (body) => {
        const response = await admin.post('/api/queues/advising/serve-next').send(body)

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Serve next does not accept request fields')
        expect(getAllEntries().every(entry => entry.status === 'waiting')).toBe(true)
    })

    test('reads new entries from the same collection used by the user module', async () => {
        insertEntry({ id: 'new', userId: 'new-user', username: 'new@example.com', serviceId: 'advising', priority: 'Medium', joinedAt: 3000, endedAt: null, status: 'waiting' })

        const response = await admin.get('/api/queues')

        expect(response.body.queues[0].queue[2]).toMatchObject({ id: 'new', position: 3, estimatedWaitMinutes: 40 })
    })

    test('uses service changes made through the existing service API', async () => {
        const update = await admin.patch('/api/services/advising').send({ duration: 5 })
        expect(update.status).toBe(200)

        const response = await admin.get('/api/queues')

        expect(response.body.queues[0]).toMatchObject({ duration: 5, estimatedWaitMinutes: 10 })
    })

    test('removes a visitor, preserves history, and updates positions and notifications', async () => {
        const before = Date.now()
        const response = await admin.post('/api/queues/advising/entries/urgent/remove')

        expect(response.status).toBe(200)
        expect(response.body.removedEntry).toMatchObject({ id: 'urgent', status: 'removed' })
        expect(response.body.removedEntry.endedAt).toBeGreaterThanOrEqual(before)
        expect(db.prepare('SELECT status, ended_at FROM queue_entries WHERE entry_id = ?').get('urgent'))
            .toEqual({ status: 'removed', ended_at: response.body.removedEntry.endedAt })
        expect(response.body.queue).toMatchObject({ queueLength: 1, estimatedWaitMinutes: 20 })
        expect(response.body.queue.queue[0]).toMatchObject({ id: 'first', position: 1, estimatedWaitMinutes: 0 })
        expect(getAllEntries()).toHaveLength(2)
        expect(getAllNotifications()).toEqual(expect.arrayContaining([
            expect.objectContaining({ userId: 'visitor-2', message: expect.stringContaining('removed') }),
            expect.objectContaining({ userId: 'visitor-1', message: expect.stringContaining("You're next") }),
        ]))
    })

    test('removes a middle visitor without changing the order or other services', async () => {
        insertEntry({ id: 'later', serviceId: 'advising', joinedAt: 3000 })
        insertEntry({ id: 'other', serviceId: 'financial-aid', joinedAt: 500 })
        const untouched = getAllEntries().filter(entry => ['urgent', 'other'].includes(entry.id))

        const response = await admin.post('/api/queues/advising/entries/first/remove')

        expect(response.status).toBe(200)
        expect(response.body.queue.queue.map(entry => [entry.id, entry.position, entry.estimatedWaitMinutes]))
            .toEqual([['urgent', 1, 0], ['later', 2, 20]])
        expect(getAllEntries().filter(entry => ['urgent', 'other'].includes(entry.id))).toEqual(untouched)
    })

    test.each(['missing', 'urgent'])('rejects missing or wrong-service entries: %s', async (entryId) => {
        const before = getAllEntries()
        const response = await admin.post(`/api/queues/financial-aid/entries/${entryId}/remove`)

        expect(response.status).toBe(404)
        expect(getAllEntries()).toEqual(before)
        expect(getAllNotifications()).toEqual([])
    })

    test.each(['serve-next', 'entries/urgent/remove'])('cannot overwrite ended history after %s', async (action) => {
        expect((await admin.post(`/api/queues/advising/${action}`)).status).toBe(200)
        const before = getAllEntries()
        const notifications = getAllNotifications()

        const response = await admin.post('/api/queues/advising/entries/urgent/remove')

        expect(response.status).toBe(409)
        expect(getAllEntries()).toEqual(before)
        expect(getAllNotifications()).toEqual(notifications)
    })

    test.each([[[]], [{ status: 'served' }], [{ userId: 'visitor-1' }]])('rejects unsupported remove input: %j', async (body) => {
        const response = await admin.post('/api/queues/advising/entries/urgent/remove').send(body)

        expect(response.status).toBe(400)
        expect(getAllEntries().every(entry => entry.status === 'waiting')).toBe(true)
    })
})

describe('Wait-time API', () => {
    test('requires authentication', async () => {
        const response = await request(app).get('/api/queues/advising/wait-time')

        expect(response.status).toBe(401)
    })

    test('lets users see the estimated wait without exposing visitor details', async () => {
        const response = await user.get('/api/queues/advising/wait-time')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({ serviceId: 'advising', queueLength: 2, estimatedWaitMinutes: 40 })
    })

    test('returns zero for an empty queue', async () => {
        const response = await user.get('/api/queues/financial-aid/wait-time')

        expect(response.body).toEqual({ serviceId: 'financial-aid', queueLength: 0, estimatedWaitMinutes: 0 })
    })

    test('returns 404 for an unknown service', async () => {
        const response = await user.get('/api/queues/missing/wait-time')

        expect(response.status).toBe(404)
    })
})
