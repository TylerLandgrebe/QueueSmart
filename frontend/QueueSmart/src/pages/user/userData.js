const STORAGE_KEY = "queuesmart-users"

export const starterUsers = [
  {
    id: "user-1",
    username: "user",
    name: "John Doe",

    currentQueue: {
        serviceId: "advising",
        position: 3,
        status: "waiting",
    }, 

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

    history: [
        {
            id: 1,
            serviceId: "financial-aid",
            joinedAt: "2026-09-29T10:00:00",
            completedAt: "2026-09-29T10:15:00", 
            outcome: "Completed",
        }
    ]
}];

export function getUsers() {
  try {
    const savedUsers = window.localStorage.getItem(STORAGE_KEY);

    return savedUsers ? JSON.parse(savedUsers) : starterUsers;
  } catch {
    return starterUsers;
  }
}

export function saveUser(user) { 
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    
    if (userIndex !== -1) {
        users[userIndex] = user;
    } else {
        users.push(user);
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function getUser(username) {
  const users = getUsers();
  return users.find(user => user.username === username);
}