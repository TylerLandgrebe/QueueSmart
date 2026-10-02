import { getUserNotifications, markNotificationAsRead, formatTimeStamp } from "./notificationData";
import { useState } from "react";
import NavigationBar from "../../components/NavigationBar"


function Notifications(){
    const session = JSON.parse(
        sessionStorage.getItem("queuesmart-session")
    );

    const [userNotifications, setUserNotifications] = useState(getUserNotifications(session?.username));
    const unreadNotifications = userNotifications?.notifications?.filter(n => !n.read).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const readNotifications = userNotifications?.notifications?.filter(n => n.read).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    function handleNotificationClick(notificationId) {
        const updatedUser = markNotificationAsRead(session?.username, notificationId);
        if (updatedUser) {
            setUserNotifications(updatedUser);
        }
    }

    function handleMarkAllAsRead() {
        let updatedUser = userNotifications;
        unreadNotifications.forEach(notification => {
            updatedUser = markNotificationAsRead(session?.username, notification.id);
        });
        setUserNotifications(updatedUser);
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