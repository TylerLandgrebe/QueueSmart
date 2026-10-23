import { useEffect, useState } from "react";
import NavigationBar from "../../components/NavigationBar";
import { fetchHistory } from "./queueApi";
import { formatTimestamp } from "./queueData";
import "./UserPages.css";

const ERROR_STYLE = { borderColor: "#e5c1c4", background: "#fbeeee", color: "#8a2f36" };

// "removed" (taken out by staff) reuses the existing red status styling
function statusClass(status) {
  return status === "removed" ? "cancelled" : status;
}

function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetchHistory()
      .then((past) => {
        if (active) setHistory(past);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

          {loadError && (
            <p className="save-message" style={ERROR_STYLE} role="alert">
              {loadError}
            </p>
          )}

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
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="service-name-cell">
                      <strong>{entry.serviceName}</strong>
                    </td>
                    <td>{formatTimestamp(entry.joinedAt)}</td>
                    <td>{formatTimestamp(entry.endedAt)}</td>
                    <td>
                      <span className={`history-status ${statusClass(entry.status)}`}>
                        {entry.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td className="table-empty" colSpan="4">
                      Loading history…
                    </td>
                  </tr>
                )}
                {!loading && !loadError && history.length === 0 && (
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
