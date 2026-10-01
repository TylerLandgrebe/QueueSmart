import NavigationBar from "../../components/NavigationBar"
import { Link } from "react-router-dom"
import { useState } from "react"
import { getUser, markNotificationAsRead } from "./userData"
import { getServices, formatWait, getWaitTime } from "../admin/adminData"
import "./UserPages.css"

const session = JSON.parse(
    sessionStorage.getItem("queuesmart-session")
);

const services = getServices();

function formatTimeStamp(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();

    const isToday = 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

    if(isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
}

function UserDashboard(){
    const [user, setUser] = useState(getUser(session?.username));
    const unreadNotifications = user?.notifications.filter(n => !n.read);

    function handleNotificationClick(notificationId) {
    const updatedUser = markNotificationAsRead(session?.username, notificationId);
    if (updatedUser) {
        setUser(updatedUser);
    }
}

    return(
        <>
            <NavigationBar userType={"user"}/>
            <main className="user-page">
                <div className="user-content">
                    <header className="user-topline">
                        <div>
                            <p className="user-brand">QueueSmart / User</p>
                            <h1>Welcome to QueueSmart</h1>
                            <p className="user-subtitle">Check your queue status and manage your appointments.</p>
                        </div>
                    </header>

                    <section className="current-queues" aria-label="User overview">
                        <div className="user-section-heading">
                            <h2 id="current-queues-title">Current Queues</h2>
                            <p>View your current queue positions and statuses.</p>
                        </div>

                        <div className="table-scroll">
                            <table className="user-table">
                                <thead>
                                    <tr>
                                        <th>Service</th>
                                        <th>Position</th>
                                        <th>Estimated Wait Time</th>
                                        <th>Status</th>
                                        <th scope="col">
                                            <span className='visually-hidden'>
                                                Queue Action
                                            </span>
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {user?.currentQueue.map((queue) => {
                                        const service = services.find(
                                            s => s.id === queue.serviceId
                                        );

                                        if (!service) {
                                            return null; // Skip if service not found
                                        }

                                        return (
                                            <tr key={queue.serviceId}>
                                                <td className="service-name-cell">
                                                    <strong>{service.name}</strong>
                                                    <span>
                                                        {service.duration} min service
                                                    </span>
                                                </td>
                                                <td>#{queue.position}</td>
                                                <td>{formatWait(queue.position * service.duration)}</td>
                                                <td>{queue.status}</td>
                                                <td className="queue-action-cell">
                                                    <Link className="table-action" to="/queue-status">
                                                        View Status
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}

                                    {user.currentQueue.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="table-empty">
                                                You are not currently in any queues.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="services-summary" aria-labelledby="service-overview-title">
                        <div className="user-section-heading">
                            <div>
                                <h2 id="service-overview-title">Available Services</h2>
                                <p>Join a queue for any of the following services.</p>
                            </div>
                            <Link className="user-link" to="/join-queue">Join a queue</Link>
                        </div>

                        <div className="table-scroll">
                            <table className="user-table">
                                <thead>
                                    <tr>
                                        <th>Service</th>
                                        <th>Queue Length</th>
                                        <th>Estimated Wait</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {services.filter((service) => service.isOpen).map((service) => (
                                        <tr key={service.id}>
                                            <td className="service-name-cell">
                                                <strong>{service.name}</strong>
                                            </td>
                                            <td>{service.queue.length}</td>
                                            <td>{service.isOpen ? formatWait(getWaitTime(service)) : "N/A"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="notifications-summary" aria-labelledby="notifications-title">
                        <div className="user-section-heading">
                            <div>
                                <h2 id="notifications-title">Notifications</h2>
                                <p>Stay updated on your queue status and appointments.</p>
                            </div>

                            <Link className="user-link" to="/notifications">
                                View All Notifications
                            </Link>
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

                            {unreadNotifications.length === 0 && (
                                <p className="notifications-empty">You have no new notifications.</p>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </>
    )
}

export default UserDashboard