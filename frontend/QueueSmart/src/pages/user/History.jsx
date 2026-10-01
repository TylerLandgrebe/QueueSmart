import { useState } from "react";
import NavigationBar from "../../components/NavigationBar";
import { getEntries, getUserEntries, formatTimestamp } from "./queueData";
import "./UserPages.css";

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem("queuesmart-session"));
  } catch {
    return null;
  }
}

function statusLabel(status) {
  if (status === "served") return "Served";
  if (status === "left") return "Left queue";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function History() {
  const session = getSession();
  const username = session?.username ?? "guest";
  const [entries] = useState(getEntries);

  const pastEntries = getUserEntries(entries, username)
    .filter((entry) => entry.status !== "waiting")
    .sort((a, b) => (b.endedAt ?? b.joinedAt) - (a.endedAt ?? a.joinedAt));

  return (
    <>
      <NavigationBar userType="user" />
      <main className="user-page">
        <div className="user-content">
          <header className="user-topline">
            <div>
              <p className="user-brand">QueueSmart / History</p>
              <h1>Your queue history</h1>
              <p className="user-subtitle">A record of the services you've joined in the past.</p>
            </div>
          </header>

          <div className="table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Ended</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {pastEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="service-name-cell">
                      <strong>{entry.serviceName}</strong>
                    </td>
                    <td>{formatTimestamp(entry.joinedAt)}</td>
                    <td>{formatTimestamp(entry.endedAt)}</td>
                    <td>
                      <span className={`history-status ${entry.status}`}>{statusLabel(entry.status)}</span>
                    </td>
                  </tr>
                ))}
                {pastEntries.length === 0 && (
                  <tr>
                    <td className="table-empty" colSpan="4">
                      No past queue activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}

export default History;
