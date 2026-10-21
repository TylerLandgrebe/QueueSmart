import { beforeEach, describe, expect, test } from 'vitest'
import { queueEntries, getQueue, getWaitingEntriesForService, serveNext } from '../src/data/queueData.js'

const service = { id: 'advising', duration: 20, priority: 'Medium' }
const startingEntries = [
    { id: 'later', serviceId: 'advising', username: 'later@example.com', priority: 'Medium', joinedAt: 2000, endedAt: null, status: 'waiting' },
    { id: 'first', serviceId: 'advising', username: 'first@example.com', priority: 'Medium', joinedAt: 1000, endedAt: null, status: 'waiting' },
    { id: 'urgent', serviceId: 'advising', username: 'urgent@example.com', priority: 'High', joinedAt: 3000, endedAt: null, status: 'waiting' },
    { id: 'other', serviceId: 'financial-aid', priority: 'High', joinedAt: 500, status: 'waiting' },
    { id: 'served', serviceId: 'advising', priority: 'High', joinedAt: 500, endedAt: 1000, status: 'served' },
    { id: 'left', serviceId: 'advising', priority: 'High', joinedAt: 500, endedAt: 1000, status: 'left' },
]

describe('Shared queue and wait-time logic', () => {
    beforeEach(() => {
        queueEntries.splice(0, queueEntries.length, ...structuredClone(startingEntries))
    })

    test('orders waiting entries by priority, then arrival, within one service', () => {
        const ordered = getWaitingEntriesForService(service.id)

        expect(ordered.map(entry => entry.id)).toEqual(['urgent', 'first', 'later'])
    })

    test('keeps insertion order when priority and arrival time are equal', () => {
        queueEntries.push({ ...startingEntries[1], id: 'tie' })

        const ordered = getWaitingEntriesForService(service.id)

        expect(ordered.map(entry => entry.id)).toEqual(['urgent', 'first', 'tie', 'later'])
    })

    test('places Low priority after Medium even when Low arrived earlier', () => {
        queueEntries.push({ ...startingEntries[1], id: 'low', priority: 'Low', joinedAt: 1 })

        expect(getWaitingEntriesForService(service.id).at(-1).id).toBe('low')
    })

    test('returns server positions and waits for the people ahead of each visitor', () => {
        const queue = getQueue(service)

        expect(queue.queue.map(entry => [entry.id, entry.position, entry.estimatedWaitMinutes])).toEqual([
            ['urgent', 1, 0], ['first', 2, 20], ['later', 3, 40],
        ])
        expect(queue).toMatchObject({ queueLength: 3, estimatedWaitMinutes: 60 })
    })

    test('derives estimates from the current service duration', () => {
        const queue = getQueue({ ...service, duration: 10 })

        expect(queue.estimatedWaitMinutes).toBe(30)
        expect(queue.queue[2].estimatedWaitMinutes).toBe(20)
    })

    test('returns zero wait and an empty array for an empty queue', () => {
        expect(getQueue({ ...service, id: 'empty' })).toMatchObject({
            queue: [], queueLength: 0, estimatedWaitMinutes: 0,
        })
    })

    test('reading a queue does not reorder or decorate the stored entries', () => {
        const before = structuredClone(queueEntries)

        getQueue(service)

        expect(queueEntries).toEqual(before)
    })

    test('serves the next entry and retains its completed record for history', () => {
        const before = Date.now()

        const served = serveNext(service.id)

        expect(served).toMatchObject({ id: 'urgent', status: 'served' })
        expect(served.endedAt).toBeGreaterThanOrEqual(before)
        expect(queueEntries).toContain(served)
        expect(queueEntries).toHaveLength(startingEntries.length)
        expect(getQueue(service)).toMatchObject({ queueLength: 2, estimatedWaitMinutes: 40 })
    })

    test('serving one service leaves other services and completed entries unchanged', () => {
        const otherEntries = structuredClone(queueEntries.filter(entry => entry.id !== 'urgent'))

        serveNext(service.id)

        expect(queueEntries.filter(entry => entry.id !== 'urgent')).toEqual(otherEntries)
    })

    test('serves each visitor once, then returns null without changing history', () => {
        expect([serveNext(service.id).id, serveNext(service.id).id, serveNext(service.id).id])
            .toEqual(['urgent', 'first', 'later'])
        const history = structuredClone(queueEntries)

        expect(serveNext(service.id)).toBeNull()
        expect(queueEntries).toEqual(history)
    })
})
