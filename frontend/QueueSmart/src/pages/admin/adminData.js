const STORAGE_KEY = "queuesmart-admin-services";

function normalizeService(service) {
  const { queueLength, ...serviceDetails } = service;
  const previousQueueLength = Number.isInteger(queueLength) ? queueLength : 0;
  const queue = Array.isArray(service.queue)
    ? service.queue
    : Array.from({ length: previousQueueLength }, (_, index) => ({
        id: `${service.id}-visitor-${index + 1}`,
        displayName: `Visitor ${index + 1}`,
        joinedAt: new Date().toISOString(),
      }));

  return { ...serviceDetails, queue };
}

export const starterServices = [
  {
    id: "advising",
    name: "Academic Advising",
    description: "Meet with an advisor about courses, degree plans, and registration.",
    duration: 20,
    priority: "Medium",
    isOpen: true,
    queue: [
      {
        id: "visitor-1",
        displayName: "Jordan Lee",
        joinedAt: "2026-09-30T14:05:00",
      },
      {
        id: "visitor-2",
        displayName: "Sam Rivera",
        joinedAt: "2026-09-30T14:12:00",
      },
    ],
  },
  {
    id: "financial-aid",
    name: "Financial Aid",
    description: "Get help with aid applications, scholarships, and account questions.",
    duration: 15,
    priority: "High",
    isOpen: true,
    queue: [],
  },
  {
    id: "it-help",
    name: "IT Help Desk",
    description: "Troubleshoot account access, devices, and campus technology.",
    duration: 10,
    priority: "Low",
    isOpen: false,
    queue: [],
  },
];

export function getServices() {
  try {
    const savedServices = window.localStorage.getItem(STORAGE_KEY);
    const services = savedServices ? JSON.parse(savedServices) : starterServices;
    return services.map(normalizeService);
  } catch {
    return starterServices.map(normalizeService);
  }
}

export function saveServices(services) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
}

export function getWaitTime(service) {
  return service.queue.length * service.duration;
}
