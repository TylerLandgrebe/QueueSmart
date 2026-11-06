import { randomUUID } from 'node:crypto'
import { findUserByUsername } from './usersData.js'

// Sample notifications belong to the seeded default user
const sampleUserId = findUserByUsername('user@email.com')?.id

export const notifications = [
    {
        id: randomUUID(),
        userId: sampleUserId,
        message: "You joined the Academic Advising queue. Your current position is 3.",
        timestamp: "2026-09-30T14:15:00",
        read: false,
    },
    {
        id: randomUUID(),
        userId: sampleUserId,
        message: "Your position in the Academic Advising queue has changed. Your new position is 2.",
        timestamp: "2026-09-30T14:16:00",
        read: false,
    }
];
 

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
