import { useState } from "react";
import { Link } from "react-router-dom";
import NavigationBar from "../../components/NavigationBar";
import { getServices } from "../admin/adminData";
import {
  getEntries,
  saveEntries,
  getUserEntries,
  getPosition,
  getEstimatedWait,
  getQueueStage,
  stageLabel,
  updateEntryStatus,
  formatWait,
} from "./queueData";
import "./UserPages.css";

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem("queuesmart-session"));
  } catch {
    return null;
  }
}

function QueueStatus() {
  const session = getSession();
  const username = session?.username ?? "guest";

  const [services] = useState(getServices);
  const [entries, setEntries] = useState(getEntries);

  const waitingEntries = getUserEntries(entries, username)
    .filter((entry) => entry.status === "waiting")
    .sort((a, b) => a.joinedAt - b.joinedAt);

  function handleLeave(entryId) {
    const updated = updateEntryStatus(entries, entryId, "left");
    setEntries(updated);
    saveEntries(updated);
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

          {waitingEntries.length === 0 && (
            <p className="table-empty">
              You're not in any queues right now. <Link to="/join-queue">Browse services</Link> to join one.
            </p>
          )}

          <div className="queue-status-list">
            {waitingEntries.map((entry) => {
              const service = services.find((item) => item.id === entry.serviceId);
              const position = getPosition(entries, entry);
              const waitMinutes = getEstimatedWait(entries, entry, service);
              const stage = getQueueStage(position);
              return (
                <article className="status-card" key={entry.id}>
                  <div className="status-card-head">
                    <h2>{entry.serviceName}</h2>
                    <span className="status-position">#{position}</span>
                  </div>
                  <span className={`status-stage ${stage}`}>{stageLabel(stage)}</span>
                  <dl className="status-card-meta">
                    <div>
                      <dt>Estimated wait</dt>
                      <dd>{formatWait(waitMinutes)}</dd>
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
                  <button className="plain-button" type="button" onClick={() => handleLeave(entry.id)}>
                    Leave queue
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}

export default QueueStatus;
