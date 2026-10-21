import express from 'express'
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js'
import { services } from '../data/servicesData.js'
import { getQueue, serveNext } from '../data/queueData.js'

const router = express.Router()

router.use(requireAuth)

router.param('serviceId', (req, res, next, serviceId) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/.test(serviceId)) {
        return res.status(400).json({ error: 'Invalid service ID' })
    }

    req.service = services.find(service => service.id === serviceId)
    if (!req.service) return res.status(404).json({ error: 'Service not found' })
    next()
})

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

export default router
