import NavigationBar from "../../components/NavigationBar"
import { Link } from "react-router-dom"
import { useEffect, useState } from "react"
import { fetchNotifications, markNotificationAsRead, formatTimeStamp } from "./notificationApi"
import { formatWait } from "../admin/adminData"
import { stageLabel } from "./queueData"
import { fetchServices, fetchMyQueues, fetchQueueSummary } from "./queueApi"
import "./UserPages.css"


function UserDashboard(){
    // Services and queue data come from the backend so they match the Services / Appointments screens
    const [services, setServices] = useState([]);
    const [currentQueues, setCurrentQueues] = useState([]);
    const [queueSummary, setQueueSummary] = useState({});

    const [notifications, setNotifications] = useState([]);
    const unreadNotifications = notifications.filter(n => !n.read);

    useEffect(() => {
        let active = true;
        Promise.all([fetchServices(), fetchMyQueues(), fetchQueueSummary()])
            .then(([serviceList, mine, summary]) => {
                if (!active) return;
                setServices(serviceList);
                setCurrentQueues(mine);
                setQueueSummary(summary);
            })
            .catch(() => {}); // dashboard just shows empty queue sections if the server is unreachable
        return () => { active = false; };
    }, []);

    useEffect(() => {
        fetchNotifications()
            .then(setNotifications)
            .catch(error => console.error("Notification fetch failed:", error));
    }, []);

    async function handleNotificationClick(notificationId) {
        try {
            const updated = await markNotificationAsRead(notificationId);
            setNotifications(current => current.map(n => n.id === updated.id ? updated : n));
        } catch (error) {
            console.error("Notification update request failed:", error);
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
                                        return (
                                            <tr key={entry.id}>
                                                <td className="service-name-cell">
                                                    <strong>{entry.serviceName}</strong>
                                                    <span>
                                                        {entry.duration} min service
                                                    </span>
                                                </td>
                                                <td>#{entry.position}</td>
                                                <td>{formatWait(entry.estimatedWait)}</td>
                                                <td>{stageLabel(entry.stage)}</td>
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
                                        const waiting = queueSummary[service.id]?.waiting ?? 0;
                                        const estimatedWait = queueSummary[service.id]?.estimatedWait ?? 0;

                                        return (
                                            <tr key={service.id}>
                                                <td className="service-name-cell">
                                                    <strong>{service.name}</strong>
                                                </td>
                                                <td>{waiting}</td>
                                                <td>{service.isOpen ? formatWait(estimatedWait) : "N/A"}</td>
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