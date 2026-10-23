import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { getUserHistory, toHistoryView } from '../data/queueData.js'

const router = express.Router()

// Past queues for the logged-in user (served, left, or removed), newest first.
router.get('/', requireAuth, (req, res) => {
    const history = getUserHistory(req.user.id).map(toHistoryView)
    return res.status(200).json({ history })
})

export default router
