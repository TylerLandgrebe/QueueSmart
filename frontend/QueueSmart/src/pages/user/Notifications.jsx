import { getUserNotifications, markNotificationAsRead, formatTimeStamp } from "./notificationData";
import { useState } from "react";
import { useAuth} from "../../auth/AuthContext.jsx"
import NavigationBar from "../../components/NavigationBar"

const API = "http://localhost:3000/"

async function fetchNotifications(){
    const response = await fetch(`${API}api/notifications/get-notifications`, {credentials: 'include'})
    return await response.json().notifications
}

function Notifications(){
    const {user} = useAuth()
    const username = user?.username ?? "guest"

    const [userNotifications, setUserNotifications] = useState(fetchNotifications());
    const unreadNotifications = userNotifications?.notifications?.filter(n => !n.read).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const readNotifications = userNotifications?.notifications?.filter(n => n.read).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    async function handleNotificationClick(notificationId) {
        try{
            const response = await fetch(`${API}api/notifications/mark-notification-as-read`,{
                credentials: 'include'
            })

            const data = await response.json()

            if(!response.ok){
                setMessage({
                    type: "error",
                    text: data.error || "Action Failed"
                })
                return
            }

            setMessage({
                type: "Success",
                text: "Notification marked as read"
            })

            setUserNotifications(fetchNotifications())

        }catch(error){
            console.error("Notification update request failed:", error)

            setMessage({
                type: "error",
                text: "Unable to connect to the server"
            })
        }
    }

    async function handleMarkAllAsRead() {
        try{
            unreadNotifications.forEach(async notification => {
                const response = await fetch(`${API}api/notifications/mark-notification-as-read`, {
                    credentials: 'include'
                })

                const data = await response.json()

                if(!response.ok){
                    setMessage({
                        type: "error",
                        text: data.error || "Action Failed"
                    })
                    return
                }
            })

            setMessage({
                type: "Success",
                text: "Notifications marked as read"
            })

            setUserNotifications(fetchNotifications())

        }catch(error){
            console.error("Notification update request failed:", error)

            setMessage({
                type: "error",
                text: "Unable to connect to the server"
            })
        }
    }

    return(
    <div>
        <NavigationBar userType={"user"}/>
        <main className="user-page">
            <div className="user-content">
                <header className="user-topline">
                    <div>
                        <p className="user-brand">QueueSmart / User</p>
                        <h1>Notifications</h1>
                        <p className="user-subtitle">View your notifications and updates.</p>
                    </div>
                </header>

                <section className="notifications-summary" aria-labelledby="notifications-title">
                        <div className="user-section-heading">
                            <div>
                                <h2 id="notifications-title">
                                    Notifications ({unreadNotifications.length} Unread)
                                </h2>
                                <p>Stay updated on your queue status and appointments.</p>
                            </div>

                            {unreadNotifications.length > 0 && (
                                <button 
                                    type="button" 
                                    className="notification-read"
                                    onClick={handleMarkAllAsRead}>
                                    Mark All as Read
                                </button>
                            )}
                        </div>

                        <div className="notifications-list">
                            {unreadNotifications.map((notification) => (
                                <div key={notification.id} className="notification-item">
                                    <i className="fa-solid fa-bell"></i>
                                    <div className="notification-content">
                                        <p>{notification.message}</p>
                                        <span className="notification-time">
                                            {formatTimeStamp(notification.timestamp)}
                                        </span>
                                    </div>

                                    <button 
                                        type="button" 
                                        className="notification-read" 
                                        onClick={() => handleNotificationClick(notification.id)}>
                                        Mark as Read
                                    </button>
                                </div>
                            ))}

                            {readNotifications.map((notification) => (
                                <div key={notification.id} className="notification-item read">
                                    <i className="fa-solid fa-bell"></i>
                                    <div className="notification-content">
                                        <p>{notification.message}</p>
                                        <span className="notification-time">
                                            {formatTimeStamp(notification.timestamp)}
                                        </span>
                                    </div>

                                    <p className="notification-read-label">Read</p>
                                </div>
                            ))}

                            {unreadNotifications.length === 0 && readNotifications.length === 0 && (
                                <p className="notifications-empty">You have no notifications.</p>
                            )}
                        </div>
                </section>
            </div>
        </main>
    </div>
    )
}

export default Notifications