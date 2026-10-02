import NavigationBar from "../../components/NavigationBar"
import { Link } from "react-router-dom"
import { useState } from "react"
import { getUserNotifications, markNotificationAsRead, formatTimeStamp } from "./notificationData"
import { getServices, formatWait } from "../admin/adminData"
import {getEntries, getUserEntries, getPosition, getEstimatedWait, getQueueStage, stageLabel, getWaitingEntriesForService} from "./queueData" 
import "./UserPages.css"


function UserDashboard(){
    const session = JSON.parse(
        sessionStorage.getItem("queuesmart-session")
    );

    const services = getServices();

    const [userNotifications, setUserNotifications] = useState(getUserNotifications(session?.username));
    const [entries, setEntries] = useState(getEntries());
    const currentQueues = getUserEntries(entries, session?.username).filter(entry => entry.status === "waiting");
    const unreadNotifications = userNotifications?.notifications?.filter(n => !n.read) ?? [];

    function handleNotificationClick(notificationId) {
        const updatedUser = markNotificationAsRead(session?.username, notificationId);
        if (updatedUser) {
            setUserNotifications(updatedUser);
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
                                    {currentQueues.map((entry) => {
                                        const service = services.find(
                                            s => s.id === entry.serviceId
                                        );

                                        if (!service) {
                                            return null; // Skip if service not found
                                        }

                                        const position = getPosition(entries, entry);
                                        const estimatedWait = getEstimatedWait(entries, entry, service);
                                        const stage = getQueueStage(position);

                                        return (
                                            <tr key={entry.serviceId}>
                                                <td className="service-name-cell">
                                                    <strong>{service.name}</strong>
                                                    <span>
                                                        {service.duration} min service
                                                    </span>
                                                </td>
                                                <td>#{position}</td>
                                                <td>{formatWait(estimatedWait)}</td>
                                                <td>{stageLabel(stage)}</td>
                                                <td className="queue-action-cell">
                                                    <Link className="table-action" to="/queue-status">
                                                        View Status
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}

                                    {currentQueues.length === 0 && (
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
                                    {services.filter((service) => service.isOpen).map((service) => {
                                        const waitingEntries = getWaitingEntriesForService(entries, service.id);
                                    
                                        return (
                                            <tr key={service.id}>
                                                <td className="service-name-cell">
                                                    <strong>{service.name}</strong>
                                                </td>
                                                <td>{waitingEntries.length}</td>
                                                <td>{service.isOpen ? formatWait(waitingEntries.length * service.duration) : "N/A"}</td>
                                            </tr>
                                        )
                                    })}    
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