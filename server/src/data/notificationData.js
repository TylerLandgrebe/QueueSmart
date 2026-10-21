import { randomUUID } from 'node:crypto'
import {users} from './usersData.js'

export const notifications = [
    {
        id: randomUUID(),
        userId: users[0].id,
        message: "You joined the Academic Advising queue. Your current position is 3.",
        timestamp: "2026-09-30T14:15:00",
        read: false,
    },
    {
        id: randomUUID(),
        userId: users[0].id,
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
