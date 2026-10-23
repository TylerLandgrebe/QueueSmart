import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NavigationBar from "../../components/NavigationBar";
import { fetchQueueStatus, leaveQueue } from "./queueApi";
import { formatWait, stageLabel } from "./queueData";
import "./UserPages.css";

const ERROR_STYLE = { borderColor: "#e5c1c4", background: "#fbeeee", color: "#8a2f36" };
const REFRESH_MS = 10000;

function QueueStatus() {
  const [entries, setEntries] = useState([]);
  const [recentlyServed, setRecentlyServed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [leavingId, setLeavingId] = useState(null);

  // Bumped after an action so the effect below re-fetches straight away
  const [refreshKey, setRefreshKey] = useState(0);

  // Load on arrival (and after each action), then poll so position / wait
  // stay live as the queue moves
  useEffect(() => {
    let active = true;

    function refresh() {
      fetchQueueStatus()
        .then((status) => {
          if (!active) return;
          setEntries(status.entries);
          setRecentlyServed(status.recentlyServed);
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

  async function handleLeave(entry) {
    setLeavingId(entry.id);
    setActionError("");
    try {
      await leaveQueue(entry.id);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setLeavingId(null);
      setRefreshKey((key) => key + 1);
    }
  }

  return (
    <>
      <NavigationBar userType="user" />
      <main className="user-page">
        <div className="user-content">
          <header className="user-topline">
            <div>
              <p className="user-brand">QueueSmart / Appointments</p>
              <h1>Your queue status</h1>
              <p className="user-subtitle">
                Live position and estimated wait for every queue you've joined.
              </p>
            </div>
            <Link className="user-button secondary" to="/join-queue">
              Join another queue
            </Link>
          </header>

          {loading && <p role="status">Loading your queues…</p>}
          {loadError && (
            <p className="save-message" style={ERROR_STYLE} role="alert">
              {loadError}
            </p>
          )}
          {actionError && (
            <p className="save-message" style={ERROR_STYLE} role="alert">
              {actionError}
            </p>
          )}

          {!loading && !loadError && entries.length === 0 && recentlyServed.length === 0 && (
            <p className="table-empty">
              You're not in any queues right now. <Link to="/join-queue">Browse services</Link> to join one.
            </p>
          )}

          <div className="queue-status-list">
            {recentlyServed.map((entry) => (
              <article className="status-card" key={entry.id}>
                <div className="status-card-head">
                  <h2>{entry.serviceName}</h2>
                  <span className="status-position" aria-hidden="true">✓</span>
                </div>
                <span className={`status-stage ${entry.stage}`}>{stageLabel(entry.stage)}</span>
                <p className="service-card-description">
                  You were served at{" "}
                  {new Date(entry.servedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  . You can find this visit in your History.
                </p>
              </article>
            ))}
            {entries.map((entry) => (
              <article className="status-card" key={entry.id}>
                <div className="status-card-head">
                  <h2>{entry.serviceName}</h2>
                  <span className="status-position">#{entry.position}</span>
                </div>
                <span className={`status-stage ${entry.stage}`}>{stageLabel(entry.stage)}</span>
                <dl className="status-card-meta">
                  <div>
                    <dt>Estimated wait</dt>
                    <dd>{formatWait(entry.estimatedWait)}</dd>
                  </div>
                  <div>
                    <dt>Priority</dt>
                    <dd>{entry.priority}</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>
                      {new Date(entry.joinedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                </dl>
                <button
                  className="plain-button"
                  type="button"
                  disabled={leavingId === entry.id}
                  onClick={() => handleLeave(entry)}
                >
                  Leave queue
                </button>
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export default QueueStatus;
