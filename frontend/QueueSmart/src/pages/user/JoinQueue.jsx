import { useEffect, useState } from "react";
import NavigationBar from "../../components/NavigationBar";
import { fetchServices, fetchQueueSummary, fetchMyQueues, joinQueue } from "./queueApi";
import { formatWait } from "./queueData";
import "./UserPages.css";

const ERROR_STYLE = { borderColor: "#e5c1c4", background: "#fbeeee", color: "#8a2f36" };
const REFRESH_MS = 15000;

function JoinQueue() {
  const [services, setServices] = useState([]);
  const [summary, setSummary] = useState({});
  const [myQueues, setMyQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }
  const [pendingServiceId, setPendingServiceId] = useState(null);

  // Bumped after an action so the effect below re-fetches straight away
  const [refreshKey, setRefreshKey] = useState(0);

  // Load on arrival (and after each action), then keep waiting counts fresh
  useEffect(() => {
    let active = true;

    function refresh() {
      Promise.all([fetchServices(), fetchQueueSummary(), fetchMyQueues()])
        .then(([serviceList, queueSummary, mine]) => {
          if (!active) return;
          setServices(serviceList);
          setSummary(queueSummary);
          setMyQueues(mine);
          setLoadError("");
        })
        .catch((error) => {
          if (active) setLoadError(error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refreshKey]);

  const visibleServices = services.filter((service) =>
    service.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function handleJoin(service) {
    setPendingServiceId(service.id);
    setMessage(null);
    try {
      await joinQueue(service.id);
      setMessage({
        type: "success",
        text: `You joined the queue for ${service.name}. Check Appointments for your position.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setPendingServiceId(null);
      setRefreshKey((key) => key + 1); // queue may have changed either way (e.g. it was just closed)
    }
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
            <p
              className="save-message"
              style={message.type === "error" ? ERROR_STYLE : undefined}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          )}

          {loading && <p role="status">Loading services…</p>}
          {loadError && (
            <p className="save-message" style={ERROR_STYLE} role="alert">
              {loadError}
            </p>
          )}

          <div className="service-card-grid">
            {visibleServices.map((service) => {
              const alreadyWaiting = myQueues.some((entry) => entry.serviceId === service.id);
              const waiting = summary[service.id]?.waiting ?? 0;
              const estimatedWait = summary[service.id]?.estimatedWait ?? 0;
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
                      <dd>{waiting}</dd>
                    </div>
                  </dl>
                  {service.isOpen && (
                    <p className="service-card-description">
                      Estimated wait if you join now: {formatWait(estimatedWait)}
                    </p>
                  )}
                  <button
                    className="user-button"
                    type="button"
                    disabled={!service.isOpen || alreadyWaiting || pendingServiceId === service.id}
                    onClick={() => handleJoin(service)}
                  >
                    {alreadyWaiting ? "Already in queue" : service.isOpen ? "Join queue" : "Closed"}
                  </button>
                </article>
              );
            })}
            {!loading && !loadError && visibleServices.length === 0 && (
              <p className="table-empty">No matching services.</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default JoinQueue;
