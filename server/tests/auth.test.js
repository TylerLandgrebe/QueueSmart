import { describe, test, expect, beforeEach } from "vitest"
import request from "supertest"

import app from '../src/app.js'
import { users } from '../src/data/usersData.js'
import bcrypt from 'bcrypt'

describe("Authentication - Login", () => {
    beforeEach(async () => {
        users.length = 0

        const hashedPassword = await bcrypt.hash("Password123", 10)

        users.push({
            id: "test-user-1",
            username: "user@email.com",
            passwordHash: hashedPassword,
            role: "user"
        })
    })

    test("Login with correct credentials", async() => {
        const user = {
            username: "user@email.com",
            password: "Password123"
        }

        const response = await request(app)
            .post('/api/auth/login')
            .send(user)

        expect(response.status).toBe(200)
        expect(response.body.message).toBe("Login successful")
        expect(response.body.user.username).toBe(user.username)
        expect(response.body.user.passwordHash).toBeUndefined()
        expect(response.body.user.role).toBe("user")

        // Make sure user id and username match
        const userFound = users.find(user => user.id === response.body.user.id)
        expect(userFound).toBeDefined()
        expect(userFound.username).toBe(user.username)
    })

    test("Login with incoreect password", async() => {
        const user = {
            username: "user@email.com",
            password: "wrongPassword"
        }

        const response = await request(app)
            .post('/api/auth/login')
            .send(user)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe("Invalid login credentials")
    })

    test("Login with nonexistent username", async() => {
        const user = {
            username: "doesNotExist@email.com",
            password: "Password999"
        }

        const response = await request(app)
            .post('/api/auth/login')
            .send(user)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe("Invalid login credentials")
    })

    test.each([
        {},
        { username: "user@email.com" },
        { password: "Password123"},
        { username: "", password: ""},
        { username: null, password: null},
        { username: 123, password: "Password123"}
    ])("Rejects missing or invalid credentials", async(credentials) => {

        const response = await request(app)
            .post('/api/auth/login')
            .send(credentials)

        expect(response.status).toBe(400)
        expect(response.body.error).toBe("Username and password are required")
    })
})

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
        expect(response.body.message).toBe('User registered successfully')

        //Check that the user was actually created
        expect(users).toHaveLength(1)
        expect(users[0].username).toBe('test@example.com')
        expect(users[0].role).toBe('user')

        //Check that password is hashed, not stored as plaintext
        expect(users[0].passwordHash).not.toBe(newUser.password)

        const passwordMatches = await bcrypt.compare(
            newUser.password,
            users[0].passwordHash
        )
        expect(passwordMatches).toBe(true)
    })

    test("Register with invalid email", async () => {
        const newUser = {
            username: "user@email",
            password: "validPassword"
        }

        const response = await request(app)
            .post('/api/auth/register')
            .send(newUser)

        expect(response.status).toBe(400)
        expect(response.body.error).toBe("invalid email")
        expect(users).toHaveLength(0)
    })

    test("Register with invalid password", async() => {
        const newUser = {
            username: "test@email.com",
            password: "pass"
        }

        const response = await request(app)
            .post('/api/auth/register')
            .send(newUser)

        expect(response.status).toBe(400)
        expect(response.body.error).toBe("invalid password")
        expect(users).toHaveLength(0)
    })

    test("Register with an existing user", async() => {
        const newUser1 = {
            username: "test@email.com",
            password: "validPassword"
        }

        const newUser2 = {
            username: "test@email.com",
            password: "excellentPassword"
        }

        const response1 = await request(app)
            .post('/api/auth/register')
            .send(newUser1)
        
        expect(response1.status).toBe(201)

        const response2 = await request(app)
            .post('/api/auth/register')
            .send(newUser2)

        expect(response2.status).toBe(409)
        expect(response2.body.error).toBe("User already exists")
        expect(users).toHaveLength(1)

        //Verify the password was not overwritten
        const passwordMatches = await bcrypt.compare(
            newUser1.password,
            users[0].passwordHash
        )

        expect(passwordMatches).toBe(true)
    })

    test.each([
        { username: "", password: "validPassword"},
        { username: "test@email.com", password: ""},
        { username: 12345, password: "validPassword"},
        { username: "test@email.com", password: null }
    ])("Rejects invalid registration input: %j", async (newUser) => {
        const response = await request(app)
            .post('/api/auth/register')
            .send(newUser)

        expect(response.status).toBe(400)
        expect(response.body.error).toBe("Missing or Invalid username or password")
        expect(users).toHaveLength(0)
    })
})