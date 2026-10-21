export const queueEntries = []

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }

export function getQueue(service) {
    const queue = getWaitingEntriesForService(service.id).map((entry, index) => ({
        ...entry,
        position: index + 1,
        estimatedWaitMinutes: index * service.duration,
    }))

    return {
        ...service,
        queue,
        queueLength: queue.length,
        estimatedWaitMinutes: queue.length * service.duration,
    }
}

export function getWaitingEntriesForService(serviceId) {
    return queueEntries
        .filter(entry => entry.serviceId === serviceId && entry.status === 'waiting')
        .sort((first, second) =>
            PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority]
            || first.joinedAt - second.joinedAt)
}

export function serveNext(serviceId) {
    const nextEntry = getWaitingEntriesForService(serviceId)[0]
    if (!nextEntry) return null

    nextEntry.status = 'served'
    nextEntry.endedAt = Date.now()
    return nextEntry
}
