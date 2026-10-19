const express = require('express')
const app = express()
const cors = require('cors')

const authRoutes = require('./routes/authRoutes.js')
const serviceRoutes = require('./routes/serviceRoutes.js')
const queueRoutes = require('./routes/queueRoutes.js')
const notificationRoutes = require("./routes/notificationRoutes.js")
const historyRoutes = require("./routes/historyRoutes.js")

// Middleware
app.use(cors())
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/services", serviceRoutes)
app.use("/api/queues", queueRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/history", historyRoutes)

export default app