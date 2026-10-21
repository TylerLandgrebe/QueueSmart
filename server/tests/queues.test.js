import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { services } from '../src/data/servicesData.js'
import { queueEntries } from '../src/data/queueData.js'

const startingServices = structuredClone(services)
const admin = request.agent(app)
const user = request.agent(app)

beforeAll(async () => {
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin@email.com', password: 'adminPass' })
    const userLogin = await user.post('/api/auth/login').send({ username: 'user@email.com', password: 'Password123' })
    expect(adminLogin.status).toBe(200)
    expect(userLogin.status).toBe(200)
})

beforeEach(() => {
    services.splice(0, services.length, ...structuredClone(startingServices))
    queueEntries.splice(0, queueEntries.length,
        { id: 'first', userId: 'visitor-1', username: 'first@example.com', serviceId: 'advising', priority: 'Medium', joinedAt: 1000, endedAt: null, status: 'waiting' },
        { id: 'urgent', userId: 'visitor-2', username: 'urgent@example.com', serviceId: 'advising', priority: 'High', joinedAt: 2000, endedAt: null, status: 'waiting' },
    )
})

describe('Admin queue APIs', () => {
    test.each([
        ['get', '/api/queues'],
        ['post', '/api/queues/advising/serve-next'],
    ])('requires a session for %s %s', async (method, path) => {
        const response = await request(app)[method](path)

        expect(response.status).toBe(401)
        expect(queueEntries.every(entry => entry.status === 'waiting')).toBe(true)
    })

    test.each([
        ['get', '/api/queues'],
        ['post', '/api/queues/advising/serve-next'],
    ])('rejects a regular user for %s %s', async (method, path) => {
        const response = await user[method](path)

        expect(response.status).toBe(403)
        expect(queueEntries.every(entry => entry.status === 'waiting')).toBe(true)
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
        expect(queueEntries.find(entry => entry.id === 'urgent').status).toBe('served')
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
        expect(queueEntries.every(entry => entry.status === 'waiting')).toBe(true)
    })

    test.each([[[]], [{ entryId: 'first' }], [{ status: 'served' }]])('rejects unsupported serve-next input: %j', async (body) => {
        const response = await admin.post('/api/queues/advising/serve-next').send(body)

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Serve next does not accept request fields')
        expect(queueEntries.every(entry => entry.status === 'waiting')).toBe(true)
    })

    test('reads new entries from the same collection used by the user module', async () => {
        queueEntries.push({ id: 'new', userId: 'new-user', username: 'new@example.com', serviceId: 'advising', priority: 'Medium', joinedAt: 3000, endedAt: null, status: 'waiting' })

        const response = await admin.get('/api/queues')

        expect(response.body.queues[0].queue[2]).toMatchObject({ id: 'new', position: 3, estimatedWaitMinutes: 40 })
    })

    test('uses service changes made through the existing service API', async () => {
        const update = await admin.patch('/api/services/advising').send({ duration: 5 })
        expect(update.status).toBe(200)

        const response = await admin.get('/api/queues')

        expect(response.body.queues[0]).toMatchObject({ duration: 5, estimatedWaitMinutes: 10 })
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
