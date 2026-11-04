import { beforeEach, describe, expect, test } from 'vitest'
import { services, validateService, createService, updateService } from '../src/data/servicesData.js'
import db from '../src/db/database.js'

const startingServices = [
    {
        id: 'advising',
        name: 'Academic Advising',
        description: 'Meet with an advisor about courses, degree plans, and registration.',
        duration: 20,
        priority: 'Medium',
        isOpen: true
    },
    {
        id: 'financial-aid',
        name: 'Financial Aid',
        description: 'Get help with aid applications, scholarships, and account questions.',
        duration: 15,
        priority: 'High',
        isOpen: true
    },
    {
        id: 'it-help',
        name: 'IT Help Desk',
        description: 'Troubleshoot account access, devices, and campus technology.',
        duration: 10,
        priority: 'Low',
        isOpen: false
    }
]

const validService = {
    name: 'Academic Coaching',
    description: 'Get help planning your study schedule.',
    duration: 30,
    priority: 'Medium'
}

describe('Service management business logic', () => {
    function resetServiceDatabase() {
        const reset = db.transaction(() => {
            db.prepare('DELETE FROM services').run()

            const insertService = db.prepare(`
                INSERT INTO services (id, name, description, duration, priority)
                VALUES (?, ?, ?, ?, ?)
            `)

            const insertQueue = db.prepare(`
                INSERT INTO queues (queue_id, service_id, status)
                VALUES (?, ?, ?)
            `)

            for (const service of startingServices) {
                insertService.run(
                    service.id,
                    service.name,
                    service.description,
                    service.duration,
                    service.priority
                )

                insertQueue.run(
                    `queue-${service.id}`,
                    service.id,
                    service.isOpen ? 'open' : 'closed'
                )
            }
        })

        reset()
    }

    beforeEach(() => {
        resetServiceDatabase()
        services.splice(0, services.length, ...structuredClone(startingServices))
    })

    test('provides a seeded in-memory catalog', () => {
        expect(services).toHaveLength(3)
        expect(services[0]).toMatchObject({ id: 'advising', duration: 20, priority: 'Medium' })
    })

    test('accepts valid service details', () => {
        expect(validateService(validService).errors).toBeNull()
    })

    test.each([
        [{ ...validService, name: '' }, 'name'],
        [{ ...validService, name: 'A'.repeat(101) }, 'name'],
        [{ ...validService, description: 42 }, 'description'],
        [{ ...validService, description: 'D'.repeat(501) }, 'description'],
        [{ ...validService, duration: '30' }, 'duration'],
        [{ ...validService, duration: 0 }, 'duration'],
        [{ ...validService, duration: 481 }, 'duration'],
        [{ ...validService, priority: 'Urgent' }, 'priority'],
        [{ name: validService.name }, 'description'],
        [null, 'body']
    ])('rejects invalid fields (%j)', (input, field) => {
        expect(validateService(input).errors).toHaveProperty(field)
    })

    test.each([
        ['long name', 'N'.repeat(101), 'Valid Description', 20, 'Medium'],
        ['long description', 'Valid Name', 'D'.repeat(501), 20, 'Medium'],
        ['invalid duration', 'Valid Name', 'Valid Description', '0', 'Medium'],
        ['invalid priority', 'Valid Name', 'Valid Description', 20, 'Urgent']
    ])('database rejects a service with %s', (_caseName, name, description, duration, priority) => {
        const insertService = db.prepare(`
            INSERT INTO services (id, name, description, duration, priority)
            VALUES (?, ?, ?, ?, ?)
        `)

        expect(() => {
            insertService.run('invalid-service', name, description, duration, priority)
        }).toThrow()
    })

    test('database prevents a service from having two open queues', () =>{
        const insertQueue = db.prepare(`
            INSERT INTO queues (queue_id, service_id, status)
            VALUES (?, ?, ?)
        `)

        expect(() => {
            insertQueue.run('another-advising-queue', 'advising', 'open')
        }).toThrow()
    })

    test('validates partial service updates without requiring every field', () => {
        expect(validateService({ isOpen: false }, { partial: true }).errors).toBeNull()
        expect(validateService({ isOpen: 'false' }, { partial: true }).errors).toHaveProperty('isOpen')
        expect(validateService({ unknown: true }, { partial: true }).errors).toHaveProperty('unknown')
    })

    test('creates a service with a generated ID and an open queue', () => {
        const service = createService(validService)
        expect(service).toMatchObject({ ...validService, isOpen: true })
        expect(service.id).toBeTruthy()
        expect(services).toContain(service)

        const savedService = db.prepare(`
            SELECT id, name, description, duration, priority
            FROM services
            WHERE id = ?
        `).get(service.id)

        expect(savedService).toMatchObject({
            id: service.id,
            ...validService
        })

        const savedQueue = db.prepare(`
            SELECT status
            FROM queues
            WHERE service_id = ?
        `).get(service.id)

        expect(savedQueue).toEqual({ status: 'open' })
    })

    test('trims text fields when creating a service', () => {
        const service = createService({ ...validService, name: '  Advising  ', description: '  Talk to an advisor.  ' })
        expect(service.name).toBe('Advising')
        expect(service.description).toBe('Talk to an advisor.')
    })

    test('updates selected fields and keeps all other service data', () => {
        const updated = updateService('it-help', { duration: 12, isOpen: true })
        expect(updated).toMatchObject({
            id: 'it-help',
            name: 'IT Help Desk',
            duration: 12,
            isOpen: true
        })

        const savedService = db.prepare(`
            SELECT duration
            FROM services
            WHERE id = ?
        `).get('it-help')

        expect(savedService).toEqual({ duration: 12})

        const savedQueue = db.prepare(`
            SELECT status
            FROM queues
            WHERE queue_id = ?
        `).get('queue-it-help')

        expect(savedQueue).toEqual({ status: 'open' })
    })

    test('returns null when an update targets an unknown service', () => {
        expect(updateService('missing-id', { duration: 12 })).toBeNull()
    })
})
