import { fetchNotifications, markNotificationAsRead, formatTimeStamp } from "./notificationApi";
import { useEffect, useState } from "react";
import NavigationBar from "../../components/NavigationBar"

const byNewest = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);

function Notifications(){
    const [notifications, setNotifications] = useState([]);
    const [message, setMessage] = useState(null);
    const unreadNotifications = notifications.filter(n => !n.read).sort(byNewest);
    const readNotifications = notifications.filter(n => n.read).sort(byNewest);

    async function loadNotifications() {
        try {
            setNotifications(await fetchNotifications());
        } catch (error) {
            console.error("Notification fetch failed:", error);
            setMessage({ type: "error", text: error.message });
        }
    }

    useEffect(() => {
        loadNotifications();
    }, []);

    async function handleNotificationClick(notificationId) {
        try{
            await markNotificationAsRead(notificationId);
            setMessage({ type: "success", text: "Notification marked as read" });
        }catch(error){
            console.error("Notification update request failed:", error);
            setMessage({ type: "error", text: error.message });
        }
        loadNotifications();
    }

    async function handleMarkAllAsRead() {
        try{
            await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)));
            setMessage({ type: "success", text: "Notifications marked as read" });
        }catch(error){
            console.error("Notification update request failed:", error);
            setMessage({ type: "error", text: error.message });
        }
        loadNotifications();
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

                {message && (
                    <p className="save-message" role="status">
                        {message.text}
                    </p>
                )}

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