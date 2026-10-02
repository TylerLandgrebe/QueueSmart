import { useState } from "react";
import NavigationBar from "../../components/NavigationBar";
import { getServices } from "../admin/adminData";
import { getEntries, saveEntries, createEntry, isWaiting, getPosition } from "./queueData";
import { addNotification } from "./notificationData";
import "./UserPages.css";

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem("queuesmart-session"));
  } catch {
    return null;
  }
}

function JoinQueue() {
  const session = getSession();
  const username = session?.username ?? "guest";

  const [services] = useState(getServices);
  const [entries, setEntries] = useState(getEntries);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const visibleServices = services.filter((service) =>
    service.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function handleJoin(service) {
    if (isWaiting(entries, username, service.id)) {
      setMessage(`You're already in the queue for ${service.name}.`);
      return;
    }
    const newEntry = createEntry(username, service);
    const updated = [...entries, newEntry];
    setEntries(updated);
    saveEntries(updated);
    const position = getPosition(updated, newEntry);
    addNotification(username, `You joined the queue for ${service.name}. Your current position is ${position}.`);
    setMessage(`You joined the queue for ${service.name}. Check Appointments for your position.`);
  }

  return (
    <>
      <NavigationBar userType="user" />
      <main className="user-page">
        <div className="user-content">
          <header className="user-topline">
            <div>
              <p className="user-brand">QueueSmart / Services</p>
              <h1>Browse services</h1>
              <p className="user-subtitle">
                Join a queue for an open service, then track your spot under Appointments.
              </p>
            </div>
          </header>

          <div className="service-toolbar">
            <input
              className="service-search"
              aria-label="Search services"
              type="search"
              placeholder="Search by service name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {message && (
            <p className="save-message" role="status">
              {message}
            </p>
          )}

          <div className="service-card-grid">
            {visibleServices.map((service) => {
              const alreadyWaiting = isWaiting(entries, username, service.id);
              return (
                <article className="service-card" key={service.id}>
                  <div className="service-card-head">
                    <h2>{service.name}</h2>
                    <span className={`queue-state ${service.isOpen ? "is-open" : "is-closed"}`}>
                      {service.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>
                  <p className="service-card-description">{service.description}</p>
                  <dl className="service-card-meta">
                    <div>
                      <dt>Duration</dt>
                      <dd>{service.duration} min</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{service.priority}</dd>
                    </div>
                    <div>
                      <dt>Currently waiting</dt>
                      <dd>{service.queueLength}</dd>
                    </div>
                  </dl>
                  <button
                    className="user-button"
                    type="button"
                    disabled={!service.isOpen || alreadyWaiting}
                    onClick={() => handleJoin(service)}
                  >
                    {alreadyWaiting ? "Already in queue" : service.isOpen ? "Join queue" : "Closed"}
                  </button>
                </article>
              );
            })}
            {visibleServices.length === 0 && <p className="table-empty">No matching services.</p>}
          </div>
        </div>
      </main>
    </>
  );
}

export default JoinQueue;
