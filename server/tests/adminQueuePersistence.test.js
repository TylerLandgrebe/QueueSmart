import { afterAll, expect, test } from 'vitest'
import request from 'supertest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Use a real temporary file so a fresh process can verify persistence.
const directory = mkdtempSync(join(tmpdir(), 'queuesmart-admin-'))
const databasePath = join(directory, 'queues.sqlite')
process.env.QUEUESMART_DB_PATH = databasePath
const { default: app } = await import('../src/app.js')
const { default: db } = await import('../src/db/database.js')

afterAll(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
})

test('admin queue creation, status, serve, and remove survive a fresh process', async () => {
    const admin = request.agent(app)
    const user = request.agent(app)
    expect((await admin.post('/api/auth/login').send({ username: 'admin@email.com', password: 'adminPass' })).status).toBe(200)
    expect((await user.post('/api/auth/login').send({ username: 'user@email.com', password: 'Password123' })).status).toBe(200)

    const created = await admin.post('/api/services').send({
        name: 'Queue persistence', description: 'Admin queue test', duration: 7, priority: 'High'
    })
    expect(created.status).toBe(201)
    const serviceId = created.body.service.id
    const queueId = `queue-${serviceId}`
    const initialQueue = db.prepare('SELECT * FROM queues WHERE queue_id = ?').get(queueId)
    expect(initialQueue).toEqual({
        queue_id: queueId, service_id: serviceId, status: 'open', created_at: expect.any(String)
    })

    const joined = await user.post('/api/queues/join').send({ serviceId })
    expect(joined.status).toBe(201)
    const removedId = joined.body.entry.id

    expect((await admin.patch(`/api/services/${serviceId}`).send({ isOpen: false })).status).toBe(200)
    expect(db.prepare('SELECT status FROM queues WHERE queue_id = ?').get(queueId).status).toBe('closed')
    expect((await user.post('/api/queues/join').send({ serviceId })).status).toBe(409)

    // Closing stops joins but lets staff finish the existing queue.
    const removed = await admin.post(`/api/queues/${serviceId}/entries/${removedId}/remove`)
    expect(removed.status).toBe(200)
    expect(removed.body.queue).toMatchObject({ isOpen: false, queueLength: 0, estimatedWaitMinutes: 0 })

    expect((await admin.patch(`/api/services/${serviceId}`).send({ isOpen: true })).status).toBe(200)
    const rejoined = await user.post('/api/queues/join').send({ serviceId })
    expect(rejoined.status).toBe(201)
    const servedId = rejoined.body.entry.id
    expect((await admin.patch(`/api/services/${serviceId}`).send({ isOpen: false })).status).toBe(200)
    const served = await admin.post(`/api/queues/${serviceId}/serve-next`)
    expect(served.status).toBe(200)
    expect(served.body.servedEntry.id).toBe(servedId)

    const saved = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
        import db from './src/db/database.js'
        import { services } from './src/data/servicesData.js'
        import { getQueue } from './src/data/queueData.js'
        console.log(JSON.stringify({
            queue: db.prepare('SELECT * FROM queues WHERE queue_id = ?').get(${JSON.stringify(queueId)}),
            entries: db.prepare('SELECT entry_id, status, joined_at, ended_at FROM queue_entries WHERE queue_id = ? ORDER BY rowid').all(${JSON.stringify(queueId)}),
            view: getQueue(services.find(service => service.id === ${JSON.stringify(serviceId)}))
        }))
        db.close()
    `], {
        cwd: new URL('..', import.meta.url),
        env: { ...process.env, QUEUESMART_DB_PATH: databasePath },
        encoding: 'utf8'
    }))

    expect(saved.queue).toEqual({ ...initialQueue, status: 'closed' })
    expect(saved.entries).toEqual([
        { entry_id: removedId, status: 'removed', joined_at: joined.body.entry.joinedAt, ended_at: removed.body.removedEntry.endedAt },
        { entry_id: servedId, status: 'served', joined_at: rejoined.body.entry.joinedAt, ended_at: served.body.servedEntry.endedAt }
    ])
    expect(saved.view).toMatchObject({ id: serviceId, isOpen: false, queue: [], queueLength: 0, estimatedWaitMinutes: 0 })
})
