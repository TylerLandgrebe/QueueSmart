import { beforeEach, describe, expect, test } from 'vitest'
import { services, validateService, createService, updateService } from '../src/data/servicesData.js'

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
    beforeEach(() => {
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
    })

    test('returns null when an update targets an unknown service', () => {
        expect(updateService('missing-id', { duration: 12 })).toBeNull()
    })
})
