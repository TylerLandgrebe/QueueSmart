const STORAGE_KEY = "queuesmart-admin-services";

export const starterServices = [
  {
    id: "advising",
    name: "Academic Advising",
    description: "Meet with an advisor about courses, degree plans, and registration.",
    duration: 20,
    priority: "Medium",
    isOpen: true,
    queueLength: 8,
  },
  {
    id: "financial-aid",
    name: "Financial Aid",
    description: "Get help with aid applications, scholarships, and account questions.",
    duration: 15,
    priority: "High",
    isOpen: true,
    queueLength: 5,
  },
  {
    id: "it-help",
    name: "IT Help Desk",
    description: "Troubleshoot account access, devices, and campus technology.",
    duration: 10,
    priority: "Low",
    isOpen: false,
    queueLength: 0,
  },
];

export function getServices() {
  try {
    const savedServices = window.localStorage.getItem(STORAGE_KEY);
    return savedServices ? JSON.parse(savedServices) : starterServices;
  } catch {
    return starterServices;
  }
}

export function saveServices(services) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
}

export function getWaitTime(service) {
  return service.queueLength * service.duration;
}
