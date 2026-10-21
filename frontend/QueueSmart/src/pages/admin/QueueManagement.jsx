import { useEffect, useState } from "react";
import NavigationBar from "../../components/NavigationBar";
import { formatWait } from "./adminData";
import "./AdminPages.css";

const API = "http://localhost:3000/api/queues";

function formatJoinTime(joinedAt) {
  return new Date(joinedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function QueueManagement() {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [serving, setServing] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(API, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load queues.");
        if (active) setServices(data.queues);
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0];

  async function serveNextVisitor() {
    if (!selectedService?.queue.length || loading || serving) return;
    setServing(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`${API}/${selectedService.id}/serve-next`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not serve the next visitor.");
      setServices((current) => current.map((service) =>
        service.id === data.queue.id ? data.queue : service,
      ));
      setMessage(`${data.servedEntry.username} was served.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setServing(false);
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
              <h1>Queue management</h1>
              <p className="admin-subtitle">
                Visitors are ordered by priority, then arrival time.
              </p>
            </div>

            <button
              className="admin-button"
              type="button"
              onClick={serveNextVisitor}
              disabled={loading || serving || !selectedService?.queue.length}
            >{serving ? "Serving…" : "Serve next"}</button>
          </header>

          {loading && <p role="status">Loading queues…</p>}
          {errorMessage && <p className="save-message" role="alert">{errorMessage}</p>}
          {message && <p className="save-message" role="status" aria-live="polite">{message}</p>}

          {selectedService ? (
            <section aria-labelledby="queue-title">
              <div className="service-toolbar">
                <h2 id="queue-title">
                  {selectedService.name} <span className="service-total">({selectedService.queue.length} waiting)</span>
                </h2>
                <select
                  id="queue-service"
                  className="service-search"
                  aria-label="Select service"
                  value={selectedService.id}
                  disabled={loading || serving}
                  onChange={(event) => {
                    setSelectedServiceId(event.target.value);
                    setMessage("");
                  }}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="admin-subtitle">
                {selectedService.duration} minutes per visitor · Estimated time to clear queue: {formatWait(selectedService.estimatedWaitMinutes)}
              </p>

              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Visitor</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Est. wait</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedService.queue.map((visitor) => (
                      <tr key={visitor.id}>
                        <td>{visitor.position}</td>
                        <td>{visitor.username}</td>
                        <td>{visitor.priority}</td>
                        <td>{formatJoinTime(visitor.joinedAt)}</td>
                        <td>{formatWait(visitor.estimatedWaitMinutes)}</td>
                      </tr>
                    ))}

                    {selectedService.queue.length === 0 && (
                      <tr>
                        <td className="table-empty" colSpan="5">
                          No visitors are waiting for this service.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : !loading && !errorMessage && (
            <p>Add a service before managing its queue.</p>
          )}
        </div>
      </main>
    </>
  );
}

export default QueueManagement;
