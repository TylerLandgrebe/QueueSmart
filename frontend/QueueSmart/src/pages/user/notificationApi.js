const API = "http://localhost:3000/api/notifications";

export async function fetchNotifications() {
    const response = await fetch(`${API}/get-notifications`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load notifications.");
    return data.notifications;
}

export async function createNotification(message) {
    const response = await fetch(`${API}/create-notification`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create notification.");
    return data.notification;
}

export async function markNotificationAsRead(notificationId) {
    const response = await fetch(`${API}/mark-notification-as-read/${notificationId}`, {
        method: "PUT",
        credentials: "include",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || "Could not update notification.");
    return data.notification;
}

export function formatTimeStamp(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();

    const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

    if(isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
}
