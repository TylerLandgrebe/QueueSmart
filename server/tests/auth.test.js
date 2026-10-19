import { describe, test, expect, beforeEach } from "vitest"
import request from "supertest"

import app from '../src/app.js'
import { users } from '../src/data/usersData.js'
import bcrypt from 'bcrypt'

describe('Authentication - Registration', () => {
    beforeEach(() => {
        //Clear users before every test
        users.length = 0
    })

    test('registers a user with valid credentials', async () => {

        // Define the registration data
        const newUser = {
            username: 'test@example.com',
            password: 'TestPassword123!'
        }

        // Send an HTTP request to the endpoint
        const response = await request(app)
            .post('/api/auth/register')
            .send(newUser)

        // Check the HTTP response
        expect(response.status).toBe(201)

        expect(response.body.message).toBe(
            'User registered successfully'
        )

        //Check taht the user was actually created
        expect(users).toHaveLength(1)

        expect(users[0].username).toBe(
            'test@example.com'
        )

        expect(users[0].role).toBe('user')

        //Check that password is hashed, not stored as plaintext
        expect(users[0].passwordHash).not.toBe(
            newUser.password
        )

        //Check that password was hashed corrctly
        const passwordMatches = await bcrypt.compare(
            newUser.password,
            users[0].passwordHash
        )

        expect(passwordMatches).toBe(true)
    })
})