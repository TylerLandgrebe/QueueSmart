// Calls to the backend queue + history endpoints (user portal).
// Same base URL / cookie-session convention as Login.jsx and AuthContext.jsx.
const API = "http://localhost:3000/";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: options.body
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
    });
  } catch {
    throw new Error("Unable to connect to the server");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// Service catalog (owned by the service module)
export async function fetchServices() {
  const data = await request("api/services");
  return data.services;
}

// { [serviceId]: { serviceId, waiting, estimatedWait } }
export async function fetchQueueSummary() {
  const data = await request("api/queues/summary");
  return Object.fromEntries(data.queues.map((queue) => [queue.serviceId, queue]));
}

// Queues the current user is waiting in (with position / wait / stage)
export async function fetchMyQueues() {
  const data = await request("api/queues/mine");
  return data.entries;
}

// Active queues plus anything just served (for the Queue Status screen)
export async function fetchQueueStatus() {
  const data = await request("api/queues/mine");
  return { entries: data.entries, recentlyServed: data.recentlyServed ?? [] };
}

export async function joinQueue(serviceId) {
  const data = await request("api/queues/join", {
    method: "POST",
    body: JSON.stringify({ serviceId }),
  });
  return data.entry;
}

export async function leaveQueue(entryId) {
  await request(`api/queues/${encodeURIComponent(entryId)}/leave`, { method: "POST" });
}

// Past queues (served / left / removed), newest first
export async function fetchHistory() {
  const data = await request("api/history");
  return data.history;
}
