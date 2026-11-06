import { beforeEach, expect, test } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import db from '../src/db/database.js'
import { createUser } from '../src/data/usersData.js'
import { getProfile } from '../src/data/profileData.js'
import { resetUsers, getAllUsers } from './helpers/users.js'

const registration = { username: 'profile@example.com', password: 'Password123', fullName: '  Test Person  ', contactInfo: '  555-1234  ' }

beforeEach(() => resetUsers())

async function registeredAgent() {
    const agent = request.agent(app)
    expect((await agent.post('/api/auth/register').send(registration)).status).toBe(201)
    expect((await agent.post('/api/auth/login').send(registration)).status).toBe(200)
    return agent
}

test('registration saves a profile and returns it on login and a later request', async () => {
    const agent = await registeredAgent()
    const response = await agent.get('/api/auth/me')
    expect(response.body.profile).toEqual({ fullName: 'Test Person', email: registration.username, contactInfo: '555-1234' })
    expect(getProfile(response.body.user.id)).toEqual(response.body.profile)
    expect(db.prepare('SELECT preferences FROM user_profiles WHERE user_id = ?').get(response.body.user.id).preferences).toBe('{}')
    expect(response.body.user.passwordHash).toBeUndefined()
})

test.each([
    { fullName: undefined }, { fullName: '' }, { fullName: '  ' }, { fullName: 3 },
    { fullName: 'a'.repeat(151) }, { contactInfo: 4 }, { contactInfo: 'a'.repeat(101) },
    { username: `${'a'.repeat(250)}@a.com` }, { password: 'a'.repeat(73) }, { password: '🔑'.repeat(19) }
])('rejects invalid registration without saving credentials or a profile: %j', async fields => {
    const response = await request(app).post('/api/auth/register').send({ ...registration, ...fields })
    expect(response.status).toBe(400)
    expect(getAllUsers()).toEqual([])
    expect(db.prepare('SELECT * FROM user_profiles').all()).toEqual([])
})

test('saves and clears optional contact information, including boundary lengths', async () => {
    const agent = await registeredAgent()
    const response = await agent.put('/api/auth/profile').send({ fullName: 'a'.repeat(150), contactInfo: 'b'.repeat(100) })
    expect(response.status).toBe(200)
    expect((await agent.get('/api/auth/me')).body.profile).toEqual(response.body.profile)
    const cleared = await agent.put('/api/auth/profile').send({ fullName: 'Updated', contactInfo: '' })
    expect(cleared.body.profile).toEqual({ fullName: 'Updated', email: registration.username, contactInfo: null })
})

test.each([{}, [], { fullName: null }, { fullName: ' ' }, { fullName: 'a'.repeat(151) },
    { fullName: 'Valid', contactInfo: {} }, { fullName: 'Valid', contactInfo: 'x'.repeat(101) },
    { fullName: 'Valid', role: 'admin' }, { fullName: 'Valid', userId: 'other' }, { fullName: 'Valid', email: 'other@example.com' }
])('rejects invalid or privileged profile updates: %j', async body => {
    const agent = await registeredAgent()
    const before = (await agent.get('/api/auth/me')).body
    expect((await agent.put('/api/auth/profile').send(body)).status).toBe(400)
    expect((await agent.get('/api/auth/me')).body).toEqual(before)
})

test('requires authentication to update a profile', async () => {
    expect((await request(app).put('/api/auth/profile').send({ fullName: 'Someone' })).status).toBe(401)
})

test('rejects passwords beyond the bcrypt byte limit at login', async () => {
    const agent = await registeredAgent()
    expect((await agent.post('/api/auth/login').send({ username: registration.username, password: 'a'.repeat(73) })).status).toBe(400)
})

test('profile updates affect only the current account and cannot grant an admin role at registration', async () => {
    const agent = await registeredAgent()
    const other = await request(app).post('/api/auth/register').send({ ...registration, username: 'other@example.com', fullName: 'Other', role: 'admin' })
    expect(other.status).toBe(201)
    expect(other.body.newUser.role).toBe('user')
    expect((await agent.put('/api/auth/profile').send({ fullName: 'Updated' })).status).toBe(200)
    expect(getProfile(other.body.newUser.id).fullName).toBe('Other')
})

test('an existing account without a profile can create one without changing credentials', async () => {
    const agent = await registeredAgent()
    db.prepare('DELETE FROM user_profiles').run()
    const before = getAllUsers()
    expect((await agent.get('/api/auth/me')).body.profile).toBeNull()
    expect((await agent.put('/api/auth/profile').send({ fullName: 'Restored', contactInfo: null })).status).toBe(200)
    expect(getAllUsers()).toEqual(before)
})

test('profile database constraints roll back the credentials when profile insertion fails', () => {
    expect(() => createUser({ username: 'broken@example.com', passwordHash: 'hash', fullName: '' })).toThrow()
    expect(getAllUsers()).toEqual([])
    expect(db.prepare('SELECT * FROM user_profiles').all()).toEqual([])
})
