const STORAGE_KEY = "queuesmart-notifications";

export const userNotifications = [
  {
    username: "user",

    notifications: [
        {
            id: 1,
            message: "You joined the Academic Advising queue. Your current position is 3.",
            timestamp: "2026-09-30T14:15:00",
            read: false,
        },
        {
            id: 2,
            message: "Your position in the Academic Advising queue has changed. Your new position is 2.",
            timestamp: "2026-09-30T14:16:00",
            read: false,
        }
    ], 
}];

export function getNotifications() {
  try {
    const savedNotifications = window.localStorage.getItem(STORAGE_KEY);

    return savedNotifications ? JSON.parse(savedNotifications) : userNotifications;
  } catch {
    return userNotifications;
  }
}

export function saveNotifications(notifications) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function getUserNotifications(username) {
  const notifications = getNotifications();
  return notifications.find(user => user.username === username);
}

export function addNotification(username, message) {
    const users = getNotifications();

    let user = users.find(u => u.username === username);

    if(!user){
        user = {
            username: username,
            notifications: []
        };
        users.push(user);
    }

    const newNotification = {
        id: user.notifications.length > 0 ? user.notifications[user.notifications.length - 1].id + 1 : 1,
        message: message,
        timestamp: new Date().toISOString(),
        read: false
    };
    user.notifications.push(newNotification);
    saveNotifications(users);

    return newNotification;
}

export function markNotificationAsRead(username, notificationId) {
    const users = getNotifications();

    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
        const user = users[userIndex];
        const notificationIndex = user.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex !== -1) {
            user.notifications[notificationIndex].read = true;
            saveNotifications(users);
        }

        return user;
    }
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