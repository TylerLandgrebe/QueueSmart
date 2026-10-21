import { describe, test, expect} from "vitest"
import { notifications } from '../src/data/notificationData.js'
import request from "supertest"

import app from '../src/app.js'

describe("Fetching Notifications", () => {
    test("Authenticated user retrieves own notifications", async () => {
        const agent = request.agent(app)

        //log in as user
        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: 'user@email.com',
                password: 'Password123'
            })

        expect(loginResponse.status).toBe(200)

        // fetch notifications
        const notifResponse = await agent.get('/api/notifications/get-notifications')

        expect(notifResponse.status).toBe(200)
        expect(notifResponse.body.notifications).toBeDefined()
        expect(notifResponse.body.notifications.length).toBeGreaterThan(0)
    })

    test("User has no notifications", async () => {
        const agent = request.agent(app)


        //register new user
        const registerResponse = await agent
            .post('/api/auth/register')
            .send({
                username: 'newUser@email.com',
                password: "newUserPass"
            })
        
        expect(registerResponse.status).toBe(201)
        
        //log in as user
        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: 'newUser@email.com',
                password: 'newUserPass'
            })

        expect(loginResponse.status).toBe(200)

        // fetch notifications
        const notifResponse = await agent.get('/api/notifications/get-notifications')

        expect(notifResponse.status).toBe(200)
        expect(notifResponse.body.notifications).toBeDefined()
        expect(notifResponse.body.notifications).toHaveLength(0)
    })

    test("Unauthenticated request", async () => {
        const response = await request(app)
            .get('/api/notifications/get-notifications')
        
        expect(response.status).toBe(401)
        expect(response.body.error).toBe("Authentication required")
    })
})

describe("Creating notifications", () => {
    test("Create notifications with valid message", async() => {
        const agent = request.agent(app)

        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: 'user@email.com',
                password: 'Password123'
            })

        expect(loginResponse.status).toBe(200)

        const response = await agent
            .post('/api/notifications/create-notification')
            .send({
                message: "This is a valid message"
            })

        expect(response.status).toBe(201)
        expect(response.body.notification.message).toBe("This is a valid message")
    })

    test.each([
    {},
    { message: "" },
    { message: null },
    { message: 123 },
    { message: "   " }
])("Rejects invalid message: %o", async (payload) => {
    const agent = request.agent(app)

    const loginResponse = await agent
        .post('/api/auth/login')
        .send({
            username: 'user@email.com',
            password: 'Password123'
        })

    expect(loginResponse.status).toBe(200)

    const initialCount = notifications.length

    const response = await agent
        .post('/api/notifications/create-notification')
        .send(payload)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(
        "A valid notification message is required"
    )

    expect(notifications).toHaveLength(initialCount)
})

    test("Unauthenticated request", async () => {
        const response = await request(app)
            .post('/api/notifications/create-notification')

        expect(response.status).toBe(401)
        expect(response.body.error).toBe("Authentication required")
    })
})

describe("Updating notifications", () => {
    test("User updates own notification", async() => {
        const agent = request.agent(app)

        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: 'user@email.com',
                password: 'Password123'
            })

        expect(loginResponse.status).toBe(200)

        const notifResponse = await agent.get('/api/notifications/get-notifications')
        expect(notifResponse.status).toBe(200)
        expect(notifResponse.body.notifications.length).toBeGreaterThan(0)

        const userNotifs = notifResponse.body.notifications
        const notifId = userNotifs[0].id
        const response = await agent.
            put(`/api/notifications/mark-notification-as-read/${notifId}`)
        
        expect(response.status).toBe(200)
        expect(response.body.notification.read).toBe(true)
    })

    test("Notification does not exist", async() => {
        const agent = request.agent(app)

        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: 'user@email.com',
                password: 'Password123'
            })

        expect(loginResponse.status).toBe(200)

        const notifId = "invalid-id"
        const response = await agent
            .put(`/api/notifications/mark-notification-as-read/${notifId}`)

        expect(response.status).toBe(404)
        expect(response.body.error).toBe("Notification not found")
    })

    test("User attempts to update another user's notification", async () => {
        const agent = request.agent(app)

        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: 'user@email.com',
                password: 'Password123'
            })

        expect(loginResponse.status).toBe(200)

        const notifResponse = await agent.get('/api/notifications/get-notifications')
        expect(notifResponse.status).toBe(200)
        expect(notifResponse.body.notifications.length).toBeGreaterThan(0)

        const userNotifs = notifResponse.body.notifications
        const notifId = userNotifs[0].id

        const logoutResponse = await agent.post('/api/auth/logout')
        expect(logoutResponse.status).toBe(200)

        //register a separate user so this test doesn't depend on other tests
        const otherUsername = `other${Date.now()}@email.com`
        const registerResponse = await agent
            .post('/api/auth/register')
            .send({
                username: otherUsername,
                password: 'otherUserPass'
            })

        expect(registerResponse.status).toBe(201)

        const newLoginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: otherUsername,
                password: 'otherUserPass'
            })

        expect(newLoginResponse.status).toBe(200)

        const response = await agent
            .put(`/api/notifications/mark-notification-as-read/${notifId}`)

        expect(response.status).toBe(404)
        expect(response.body.error).toBe("Notification not found")
    })

    test("Unauthenticated request", async() => {
        const notifId = "random-id"
        const response = await request(app)
            .put(`/api/notifications/mark-notification-as-read/${notifId}`)
        
        expect(response.status).toBe(401)
        expect(response.body.error).toBe("Authentication required")
    })
})