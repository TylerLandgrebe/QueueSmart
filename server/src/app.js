import express from 'express'
import cors from 'cors'
import session from 'express-session'

import authRoutes from './routes/authRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import queueRoutes from './routes/queueRoutes.js'
import notificationRoutes from "./routes/notificationRoutes.js"
import historyRoutes from "./routes/historyRoutes.js"
import { join } from 'node:path'

const app = express()

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))
app.use(express.json())
app.use(session({
    name: 'queuesmart.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60
    }
}))

app.use("/api/auth", authRoutes)
app.use("/api/services", serviceRoutes)
app.use("/api/queues", queueRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/history", historyRoutes)

export default app