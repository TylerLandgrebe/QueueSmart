import express from 'express'
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js'
import { services } from '../data/servicesData.js'
import {
    getQueue,
    serveNext,
    joinQueue,
    leaveQueue,
    getUserActiveEntries,
    getRecentlyServed,
    getQueueSummary,
    toActiveEntryView,
    toServedView
} from '../data/queueData.js'

const router = express.Router()

router.use(requireAuth)

// Only regular users take part in queues (admins manage them instead).
function requireUser(req, res, next) {
    if (req.user?.role !== 'user') {
        return res.status(403).json({ error: 'User access required' })
    }
    next()
}

const USER_ERROR_STATUS = {
    invalid: 400,
    'not-found': 404,
    closed: 409,
    duplicate: 409,
    'not-active': 409
}

router.param('serviceId', (req, res, next, serviceId) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/.test(serviceId)) {
        return res.status(400).json({ error: 'Invalid service ID' })
    }

    req.service = services.find(service => service.id === serviceId)
    if (!req.service) return res.status(404).json({ error: 'Service not found' })
    next()
})

// ---------- admin queue management ----------

router.get('/', requireAdmin, (req, res) => {
    return res.json({ queues: services.map(getQueue) })
})

router.get('/:serviceId/wait-time', (req, res) => {
    const { queueLength, estimatedWaitMinutes } = getQueue(req.service)
    return res.json({ serviceId: req.service.id, queueLength, estimatedWaitMinutes })
})

router.post('/:serviceId/serve-next', requireAdmin, (req, res) => {
    if (req.body !== undefined && (
        !req.body || typeof req.body !== 'object' || Array.isArray(req.body)
        || Object.keys(req.body).length > 0
    )) {
        return res.status(400).json({ error: 'Serve next does not accept request fields' })
    }

    const servedEntry = serveNext(req.service.id)
    if (!servedEntry) return res.status(409).json({ error: 'Queue is empty' })

    return res.json({ servedEntry, queue: getQueue(req.service) })
})

// ---------- user queue management ----------

// Waiting count and estimated wait for every service (used by the Services
// and Dashboard screens). Open to any logged-in account.
router.get('/summary', (req, res) => {
    return res.status(200).json({ queues: getQueueSummary() })
})

// The queues the current user is waiting in, with live position and wait,
// plus anything they were just served for (so the screen can show "Served").
router.get('/mine', requireUser, (req, res) => {
    const entries = getUserActiveEntries(req.user.id).map(toActiveEntryView)
    const recentlyServed = getRecentlyServed(req.user.id).map(toServedView)
    return res.status(200).json({ entries, recentlyServed })
})

// Join a service's queue.
router.post('/join', requireUser, (req, res) => {
    const result = joinQueue(req.user.id, req.body?.serviceId, req.user.username)
    if (result.error) {
        return res.status(USER_ERROR_STATUS[result.code]).json({ error: result.error })
    }

    return res.status(201).json({
        message: 'Joined the queue',
        entry: toActiveEntryView(result.entry)
    })
})

// Leave a queue the user is waiting in.
router.post('/:entryId/leave', requireUser, (req, res) => {
    const result = leaveQueue(req.user.id, req.params.entryId)
    if (result.error) {
        return res.status(USER_ERROR_STATUS[result.code]).json({ error: result.error })
    }

    return res.status(200).json({ message: 'Left the queue' })
})

export default router
