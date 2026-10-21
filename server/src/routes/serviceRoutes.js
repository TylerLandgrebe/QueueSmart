import express from 'express'
import { requireAdmin, requireAuth } from '../middleware/authMiddleware.js'
import { services, validateService, createService, updateService } from '../data/servicesData.js'

const router = express.Router()

// Both user and admin screens can read the same server-side service catalog.
router.get('/', requireAuth, (req, res) => {
    return res.status(200).json({ services })
})

router.post('/', requireAuth, requireAdmin, (req, res) => {
    const { errors } = validateService(req.body)
    if (errors) return res.status(400).json({ error: 'Invalid service', fields: errors })

    const service = createService(req.body)
    return res.status(201).json({ service })
})

router.put('/:id', requireAuth, requireAdmin, (req, res) => {
    const { errors } = validateService(req.body)
    if (errors) return res.status(400).json({ error: 'Invalid service', fields: errors })

    const service = updateService(req.params.id, req.body)
    if (!service) return res.status(404).json({ error: 'Service not found' })
    return res.status(200).json({ service })
})

// PATCH also supports small edits such as opening or closing a queue.
router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
    const { errors } = validateService(req.body, { partial: true })
    if (errors) return res.status(400).json({ error: 'Invalid service', fields: errors })

    const service = updateService(req.params.id, req.body)
    if (!service) return res.status(404).json({ error: 'Service not found' })
    return res.status(200).json({ service })
})

export default router
