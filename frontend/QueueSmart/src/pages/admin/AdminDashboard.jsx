import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NavigationBar from "../../components/NavigationBar";
import { getServices, getWaitTime, formatWait } from "./adminData";
import "./AdminPages.css";

const API = "http://localhost:3000/api/services";

function AdminDashboard() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const openCount = services.filter((service) => service.isOpen).length;
  const waitingCount = services
    .filter((service) => service.isOpen)
    .reduce((total, service) => total + service.queue.length, 0);

  useEffect(() => {
    fetch(API, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load services.");

        // Queue-management mock data is still local for now; match it only by
        // service ID while the service catalog itself comes from the backend.
        const localServices = new Map(getServices().map((service) => [service.id, service]));
        setServices(data.services.map((service) => ({
          ...service,
          queue: localServices.get(service.id)?.queue ?? [],
        })));
      })
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleQueue(service) {
    setErrorMessage("");
    try {
      const response = await fetch(`${API}/${service.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !service.isOpen }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update queue status.");
      setServices((current) => current.map((item) => item.id === service.id
        ? { ...item, isOpen: data.service.isOpen }
        : item));
    } catch (error) {
      setErrorMessage(error.message);
    }
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

          {loading && <p role="status">Loading services…</p>}
          {errorMessage && <p className="save-message" role="alert">{errorMessage}</p>}

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
                        <button className="table-action" type="button" onClick={() => toggleQueue(service)}>
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
