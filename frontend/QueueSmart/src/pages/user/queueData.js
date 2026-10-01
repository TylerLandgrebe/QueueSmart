// Shared storage + pure helper functions for a user's queue activity.
// Mirrors the pattern used in pages/admin/adminData.js: components keep
// their own `entries` state and call saveEntries() after every change.
//
// NOTE: service.queueLength (in adminData.js) is a separate mock counter
// that Admin owns for the dashboard summary. We intentionally don't touch
// it here to avoid stepping on Service/Queue Management's data — position
// and wait time below are computed only from real entries this file creates.

const STORAGE_KEY = "queuesmart-queue-entries";

export const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export function getEntries() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function createEntry(username, service) {
  return {
    id: `entry-${Date.now()}`,
    username,
    serviceId: service.id,
    serviceName: service.name,
    priority: service.priority,
    joinedAt: Date.now(),
    endedAt: null,
    status: "waiting", // waiting | served | left | cancelled
  };
}

export function getUserEntries(entries, username) {
  return entries.filter((entry) => entry.username === username);
}

export function isWaiting(entries, username, serviceId) {
  return entries.some(
    (entry) =>
      entry.username === username &&
      entry.serviceId === serviceId &&
      entry.status === "waiting",
  );
}

// Queue ordering: priority first (High > Medium > Low), then arrival time.
export function getWaitingEntriesForService(entries, serviceId) {
  return entries
    .filter((entry) => entry.serviceId === serviceId && entry.status === "waiting")
    .sort((a, b) => {
      const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return rankDiff !== 0 ? rankDiff : a.joinedAt - b.joinedAt;
    });
}

export function getPosition(entries, entry) {
  const ordered = getWaitingEntriesForService(entries, entry.serviceId);
  const index = ordered.findIndex((item) => item.id === entry.id);
  return index === -1 ? null : index + 1;
}

export function getEstimatedWait(entries, entry, service) {
  const position = getPosition(entries, entry);
  if (!position || !service) return 0;
  return (position - 1) * service.duration;
}

// UI-only status stage shown on the Queue Status screen while an entry is
// still "waiting" in storage. Position 1 means the admin is expected to
// serve this user next, so we surface that as "almost ready".
export function getQueueStage(position) {
  if (position === 1) return "almost-ready";
  return "waiting";
}

export function stageLabel(stage) {
  if (stage === "almost-ready") return "Almost ready";
  if (stage === "served") return "Served";
  return "Waiting";
}

// Generic status updater so Admin's future "Serve" action in Queue
// Management can reuse this too (e.g. updateEntryStatus(entries, id, "served")).
export function updateEntryStatus(entries, entryId, status) {
  return entries.map((entry) =>
    entry.id === entryId ? { ...entry, status, endedAt: Date.now() } : entry,
  );
}

export function formatWait(minutes) {
  if (minutes <= 0) return "You're next";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatTimestamp(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
