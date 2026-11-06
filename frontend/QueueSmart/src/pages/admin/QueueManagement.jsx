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
  const [updating, setUpdating] = useState(false);

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

  async function updateQueue(visitor) {
    if (!selectedService?.queue.length || loading || updating) return;
    setUpdating(true);
    setMessage("");
    setErrorMessage("");
    try {
      const action = visitor ? `entries/${encodeURIComponent(visitor.id)}/remove` : "serve-next";
      const response = await fetch(`${API}/${selectedService.id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the queue.");
      setServices((current) => current.map((service) =>
        service.id === data.queue.id ? data.queue : service,
      ));
      setMessage(visitor ? `${data.removedEntry.username} was removed.` : `${data.servedEntry.username} was served.`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
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
              onClick={() => updateQueue()}
              disabled={loading || updating || !selectedService?.queue.length}
            >{updating ? "Updating…" : "Serve next"}</button>
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
                  disabled={loading || updating}
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
                      <th scope="col"><span className="visually-hidden">Queue action</span></th>
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
                        <td>
                          <button
                            className="table-action"
                            type="button"
                            disabled={loading || updating}
                            aria-label={`Remove ${visitor.username} from queue`}
                            onClick={() => updateQueue(visitor)}
                          >Remove</button>
                        </td>
                      </tr>
                    ))}

                    {selectedService.queue.length === 0 && (
                      <tr>
                        <td className="table-empty" colSpan="6">
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
