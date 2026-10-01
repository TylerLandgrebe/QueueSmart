import { useState } from "react";
import { Link } from "react-router-dom";
import NavigationBar from "../../components/NavigationBar";
import { getServices, getWaitTime, saveServices, formatWait } from "./adminData";
import "./AdminPages.css";


function AdminDashboard() {
  const [services, setServices] = useState(getServices);
  const openCount = services.filter((service) => service.isOpen).length;
  const waitingCount = services
    .filter((service) => service.isOpen)
    .reduce((total, service) => total + service.queue.length, 0);

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
              <p className="admin-brand">QueueSmart / Administration</p>
              <h1>Service overview</h1>
              <p className="admin-subtitle">Check queue activity and control which services are open.</p>
            </div>
            <Link className="admin-button" to="/service-management">Manage services</Link>
          </header>

          <section className="overview-strip" aria-label="Queue summary">
            <p><strong>{services.length}</strong><span>services</span></p>
            <p><strong>{openCount}</strong><span>queues open</span></p>
            <p><strong>{waitingCount}</strong><span>people waiting</span></p>
          </section>

          <section className="service-overview" aria-labelledby="service-overview-title">
            <div className="admin-section-heading">
              <div>
                <h2 id="service-overview-title">Current queues</h2>
                <p>Wait estimates use the expected service duration and current queue length.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Queue</th>
                    <th scope="col">Waiting</th>
                    <th scope="col">Est. wait</th>
                    <th scope="col">Priority</th>
                    <th scope="col"><span className="visually-hidden">Queue action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="service-name-cell">
                        <strong>{service.name}</strong>
                        <span>{service.duration} minutes per visitor</span>
                      </td>
                      <td><span className={`queue-state ${service.isOpen ? "is-open" : "is-closed"}`}>{service.isOpen ? "Open" : "Closed"}</span></td>
                      <td>{service.queue.length}</td>
                      <td>{formatWait(getWaitTime(service))}</td>
                      <td>{service.priority}</td>
                      <td className="queue-action-cell">
                        <button className="table-action" type="button" onClick={() => toggleQueue(service.id)}>
                          {service.isOpen ? "Close queue" : "Open queue"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr><td className="table-empty" colSpan="6">No services yet. Use Manage services to add one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export default AdminDashboard;
