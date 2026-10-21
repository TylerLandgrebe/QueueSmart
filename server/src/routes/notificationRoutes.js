import express from 'express'
import { randomUUID } from 'node:crypto'
import {requireAuth} from '../middleware/authMiddleware.js'
import {notifications} from '../data/notificationData.js'

const router = express.Router();

router.get("/get-notifications", requireAuth, (req, res) => {
    try {
        const userId = req.user.id
        const userNotifications = notifications.filter(
            notification => notification.userId === userId
        )

        return res.status(200).json({
            notifications: userNotifications
        })
    }catch(error){
        console.error("There was a problem fetching notifications", error)
        return res.status(500).send({
            error: "Server unable to retrieve notifications for this user"
        })
    }
})

router.post("/create-notification", requireAuth, (req, res) => {
    try{
        const userId = req.user.id
        const message = req.body.message
        const timestamp = new Date().toISOString()

        if (typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                error: "A valid notification message is required"
            })
        }
        const notification = {
            id: randomUUID(),
            userId: userId,
            message: message,
            timestamp: timestamp,
            read: false
        }

        notifications.push(notification)

        return res.status(201).json({
            message: "Notification created successfully",
            notification
        })

    }catch(error){
        console.error("There was a problem creating notification", error)
        return res.status(500).json({
            error: "Server could not create notification"
        })
    }
})

router.put('/mark-notification-as-read/:id', requireAuth, (req, res) => {
    try{
        const {id} = req.params
        const userId = req.user.id

        const notification = notifications.find(n => n.id === id && n.userId === userId)
        if(!notification){
            return res.status(404).json({
                error: "Notification not found"
            })
        }

        notification.read = true

        return res.status(200).json({
            message: "Notification updated successfully",
            notification
        })
    }catch(error){
        console.error("There was a problem updating the notification", error)
        return res.status(500).json({
            message: "Server could not update the notification"
        })
    }
})

export default router