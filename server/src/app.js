import express from 'express'
import cors from 'cors'

import authRoutes from './routes/authRoutes.js'
import serviceRoutes from './routes/serviceRoutes.js'
import queueRoutes from './routes/queueRoutes.js'
import notificationRoutes from "./routes/notificationRoutes.js"
import historyRoutes from "./routes/historyRoutes.js"

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/services", serviceRoutes)
app.use("/api/queues", queueRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/history", historyRoutes)

export default app