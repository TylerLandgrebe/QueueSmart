import { randomUUID } from 'node:crypto'
import db from '../db/database.js'

// In-memory catalog for Assignment 3. Queue entries belong to the queue module.
const seedServices = [
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

const insertService = db.prepare(`
    INSERT OR IGNORE INTO services (id, name, description, duration, priority)
    VALUES (?, ?, ?, ?, ?)
`)

const insertQueue = db.prepare(`
    INSERT OR IGNORE INTO queues (queue_id, service_id, status)
    VALUES (?, ?, ?)
`)

const seedDatabase = db.transaction(() => {
    for (const service of seedServices){
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

seedDatabase()

const services = db.prepare(`
    SELECT
        s.id,
        s.name,
        s.description,
        s.duration,
        s.priority,
        EXISTS (
            SELECT 1
            FROM queues q
            WHERE q.service_id = s.id
                AND q.status = 'open'
        ) AS isOpen
    FROM services s
    ORDER BY s.id
`).all().map(service => ({
    ...service,
    isOpen: Boolean(service.isOpen)
}))

const PRIORITIES = new Set(['Low', 'Medium', 'High'])
const FIELD_LIMITS = { name: 100, description: 500 }

function validateService(input, { partial = false } = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { errors: { body: 'Request body must be a JSON object' } }
    }

    const fields = ['name', 'description', 'duration', 'priority']
    const errors = {}

    for (const field of fields) {
        if (!partial && !(field in input)) errors[field] = 'is required'
    }

    if ('name' in input) {
        if (typeof input.name !== 'string' || !input.name.trim()) errors.name = 'must be a non-empty string'
        else if (input.name.trim().length > FIELD_LIMITS.name) errors.name = `must be ${FIELD_LIMITS.name} characters or fewer`
    }

    if ('description' in input) {
        if (typeof input.description !== 'string' || !input.description.trim()) errors.description = 'must be a non-empty string'
        else if (input.description.trim().length > FIELD_LIMITS.description) errors.description = `must be ${FIELD_LIMITS.description} characters or fewer`
    }

    if ('duration' in input && (!Number.isInteger(input.duration) || input.duration < 1 || input.duration > 480)) {
        errors.duration = 'must be a whole number from 1 to 480'
    }

    if ('priority' in input && !PRIORITIES.has(input.priority)) {
        errors.priority = 'must be Low, Medium, or High'
    }

    if ('isOpen' in input && typeof input.isOpen !== 'boolean') {
        errors.isOpen = 'must be a boolean'
    }

    const allowedFields = new Set([...fields, 'isOpen'])
    for (const field of Object.keys(input)) {
        if (!allowedFields.has(field)) errors[field] = 'is not a supported field'
    }

    return { errors: Object.keys(errors).length ? errors : null }
}

function createService(input) {
    const service = {
        id: randomUUID(),
        name: input.name.trim(),
        description: input.description.trim(),
        duration: input.duration,
        priority: input.priority,
        isOpen: true
    }

    const saveServiceAndQueue = db.transaction(() => {
        db.prepare(`
            INSERT INTO services (id, name, description, duration, priority)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            service.id,
            service.name,
            service.description,
            service.duration,
            service.priority
        )

        db.prepare(`
            INSERT INTO queues (queue_id, service_id, status)
            VALUES (?, ?, ?)
        `).run(`queue-${service.id}`, service.id, 'open')
    })

    saveServiceAndQueue()
    services.push(service)

    return service
}

function updateService(id, input) {
    const service = services.find(item => item.id === id)
    if (!service) return null

    const updatedService = {
        name: input.name?.trim() ?? service.name,
        description: input.description?.trim() ?? service.description,
        duration: input.duration ?? service.duration,
        priority: input.priority ?? service.priority,
        isOpen: input.isOpen ?? service.isOpen
    }

    const saveUpdates = db.transaction(() => {
        db.prepare(`
            UPDATE services
            SET name = ?, description = ?, duration = ?, priority = ?
            WHERE id = ?
        `).run(
            updatedService.name,
            updatedService.description,
            updatedService.duration,
            updatedService.priority,
            id
        )

        if('isOpen' in input){
            db.prepare(`
                UPDATE queues
                SET status = ?
                WHERE queue_id = ?
            `).run(
                updatedService.isOpen ? 'open' : 'closed',
                `queue-${id}`
            )
        }
    })

    saveUpdates()
    Object.assign(service, updatedService)

    return service
}

export { services, validateService, createService, updateService }
