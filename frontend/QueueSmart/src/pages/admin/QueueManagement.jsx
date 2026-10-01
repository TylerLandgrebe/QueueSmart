import { useState } from "react";
import NavigationBar from "../../components/NavigationBar";
import { getServices, saveServices } from "./adminData";
import "./AdminPages.css";

function formatJoinTime(joinedAt) {
  return new Date(joinedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function QueueManagement() {
  const [services, setServices] = useState(getServices);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [message, setMessage] = useState("");

  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? services[0];

  function saveQueue(queue) {
    const updatedServices = services.map((service) =>
      service.id === selectedService.id ? { ...service, queue } : service,
    );

    setServices(updatedServices);
    saveServices(updatedServices);
  }

  function moveVisitor(index, offset) {
    const targetIndex = index + offset;

    if (targetIndex < 0 || targetIndex >= selectedService.queue.length) return;

    const queue = [...selectedService.queue];
    [queue[index], queue[targetIndex]] = [queue[targetIndex], queue[index]];

    saveQueue(queue);
    setMessage("Queue order updated.");
  }

  function removeVisitor(visitorId) {
    const queue = selectedService.queue.filter(
      (visitor) => visitor.id !== visitorId,
    );

    saveQueue(queue);
    setMessage("Visitor removed from the queue.");
  }

  function serveNextVisitor() {
    if (selectedService.queue.length === 0) return;

    const [servedVisitor, ...remainingQueue] = selectedService.queue;

    saveQueue(remainingQueue);
    setMessage(`${servedVisitor.displayName} was served.`);
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
                View and update the waiting order for a service.
              </p>
            </div>

            <button
              className="admin-button"
              type="button"
              onClick={serveNextVisitor}
              disabled={!selectedService?.queue.length}
            >
              Serve next
            </button>
          </header>

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

              <p className="save-message" role="status" aria-live="polite">{message}</p>

              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Visitor</th>
                      <th scope="col">Joined</th>
                      <th scope="col">
                        <span className="visually-hidden">Queue actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedService.queue.map((visitor, index) => (
                      <tr key={visitor.id}>
                        <td>{index + 1}</td>
                        <td>{visitor.displayName}</td>
                        <td>{formatJoinTime(visitor.joinedAt)}</td>
                        <td className="queue-action-cell">
                          <button
                            className="table-action"
                            type="button"
                            disabled={index === 0}
                            aria-label={`Move ${visitor.displayName} up`}
                            onClick={() => moveVisitor(index, -1)}
                          >
                            Up
                          </button>{" "}
                          <button
                            className="table-action"
                            type="button"
                            disabled={index === selectedService.queue.length - 1}
                            aria-label={`Move ${visitor.displayName} down`}
                            onClick={() => moveVisitor(index, 1)}
                          >
                            Down
                          </button>{" "}
                          <button
                            className="table-action"
                            type="button"
                            onClick={() => removeVisitor(visitor.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}

                    {selectedService.queue.length === 0 && (
                      <tr>
                        <td className="table-empty" colSpan="4">
                          No visitors are waiting for this service.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <p>Add a service before managing its queue.</p>
          )}
        </div>
      </main>
    </>
  );
}

export default QueueManagement;
