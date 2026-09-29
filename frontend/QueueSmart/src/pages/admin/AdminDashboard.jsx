import { useState } from "react";
import { Link } from "react-router-dom";
import NavigationBar from "../../components/NavigationBar";
import { getServices, getWaitTime, saveServices } from "./adminData";
import "./AdminPages.css";

function formatWait(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function AdminDashboard() {
  const [services, setServices] = useState(getServices);
  const openCount = services.filter((service) => service.isOpen).length;
  const totalWaiting = services.reduce((total, service) => total + service.queueLength, 0);
  const averageWait = totalWaiting
    ? Math.round(services.reduce((total, service) => total + getWaitTime(service), 0) / totalWaiting)
    : 0;

  function toggleQueue(serviceId) {
    const updatedServices = services.map((service) => service.id === serviceId
      ? { ...service, isOpen: !service.isOpen }
      : service);
    setServices(updatedServices);
    saveServices(updatedServices);
  }

  return (
    <>
      <NavigationBar userType="admin" />
      <main className="admin-page">
        <div className="admin-content">
          <header className="admin-topline">
            <div>
              <p className="admin-brand">QueueSmart · Admin Portal</p>
              <h1>Good morning, Admin</h1>
              <p className="admin-subtitle">Here’s what’s happening across your service queues today.</p>
            </div>
            <span className="admin-date">Operations overview</span>
          </header>

          <section className="admin-stats" aria-label="Queue overview">
            <article className="admin-stat">
              <div className="admin-stat-label"><span className="admin-stat-icon">▤</span> Active services</div>
              <div className="admin-stat-value">{services.length}</div>
              <div className="admin-stat-note">{openCount} queues currently open</div>
            </article>
            <article className="admin-stat">
              <div className="admin-stat-label"><span className="admin-stat-icon">♙</span> People waiting</div>
              <div className="admin-stat-value">{totalWaiting}</div>
              <div className="admin-stat-note">Across all open queues</div>
            </article>
            <article className="admin-stat">
              <div className="admin-stat-label"><span className="admin-stat-icon">◷</span> Average wait</div>
              <div className="admin-stat-value">{formatWait(averageWait)}</div>
              <div className="admin-stat-note">Estimated from service duration</div>
            </article>
            <article className="admin-stat">
              <div className="admin-stat-label"><span className="admin-stat-icon">✓</span> Served today</div>
              <div className="admin-stat-value">24</div>
              <div className="admin-stat-note">Mock activity for this preview</div>
            </article>
          </section>

          <section aria-labelledby="services-heading">
            <div className="admin-section-heading">
              <div>
                <h2 id="services-heading">Your services</h2>
                <p>Monitor queue lengths and control which services are accepting visitors.</p>
              </div>
              <Link className="admin-button" to="/service-management">＋ Manage services</Link>
            </div>

            <div className="service-grid">
              {services.map((service) => (
                <article className="service-card" key={service.id}>
                  <div className="service-card-top">
                    <h3>{service.name}</h3>
                    <span className={`status-badge ${service.isOpen ? "open" : "closed"}`}>
                      {service.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>
                  <p className="service-description">{service.description}</p>
                  <div className="service-card-meta">
                    <span className="admin-tag">◷ {service.duration} min / person</span>
                    <span className={`admin-tag priority-${service.priority.toLowerCase()}`}>{service.priority} priority</span>
                  </div>
                  <div className="service-card-footer">
                    <span className="queue-count"><strong>{service.queueLength}</strong> waiting · ~{formatWait(getWaitTime(service))}</span>
                    <button className="text-button" type="button" onClick={() => toggleQueue(service.id)}>
                      {service.isOpen ? "Close queue" : "Open queue"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="dashboard-lower">
            <section className="admin-panel" aria-labelledby="activity-heading">
              <h2 id="activity-heading">Recent activity</h2>
              <ul className="activity-list">
                <li className="activity-item"><span className="activity-dot">✓</span><span><strong>Queue activity is up to date</strong>Mock queue counts are ready for your demo.<span className="activity-time">Just now</span></span></li>
                <li className="activity-item"><span className="activity-dot">↗</span><span><strong>{openCount} services accepting visitors</strong>Toggle a queue above when service availability changes.<span className="activity-time">Today</span></span></li>
                <li className="activity-item"><span className="activity-dot">＋</span><span><strong>Service details are editable</strong>Update duration or priority in Service Management.<span className="activity-time">Today</span></span></li>
              </ul>
            </section>
            <section className="admin-panel" aria-labelledby="shortcuts-heading">
              <h2 id="shortcuts-heading">Quick actions</h2>
              <div className="shortcut-list">
                <Link className="shortcut-link" to="/service-management"><span>Create or edit a service</span><span className="shortcut-arrow">→</span></Link>
                <Link className="shortcut-link" to="/queue-management"><span>View queue entries</span><span className="shortcut-arrow">→</span></Link>
                <Link className="shortcut-link" to="/service-management"><span>Review service priorities</span><span className="shortcut-arrow">→</span></Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

export default AdminDashboard;
