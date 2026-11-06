import express from 'express'
import {requireAuth} from '../middleware/authMiddleware.js'
import {
    getNotificationsForUser,
    createNotification,
    markNotificationAsRead,
    MAX_MESSAGE_LENGTH
} from '../data/notificationData.js'

const router = express.Router();

router.get("/get-notifications", requireAuth, (req, res) => {
    try {
        const userNotifications = getNotificationsForUser(req.user.id)

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
        const message = req.body?.message

        if (typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                error: "A valid notification message is required"
            })
        }

        // Matches the length limit on the notifications table
        if (message.trim().length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                error: `Notification message must be ${MAX_MESSAGE_LENGTH} characters or fewer`
            })
        }

        const notification = createNotification(req.user.id, message)

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
        const notification = markNotificationAsRead(req.params.id, req.user.id)

        if(!notification){
            return res.status(404).json({
                error: "Notification not found"
            })
        }

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
