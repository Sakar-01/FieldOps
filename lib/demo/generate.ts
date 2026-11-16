import { addDays } from "date-fns";
import { ObjectId } from "mongodb";
import type {
  AddressDoc,
  BusinessDoc,
  CustomerDoc,
  JobDoc,
  Priority,
  StatusChange,
  UserDoc,
} from "@/lib/db/types";
import type { JobStatus } from "@/lib/domain/job-status";
import { dayKey, zonedToIso } from "@/lib/domain/time";

/** The demo accounts. example.com is reserved, so these can never reach a real inbox. */
export const DEMO_EMAILS = {
  owner: "owner@demo.example.com",
  dispatcher: "dispatcher@demo.example.com",
  technician: "ravi@demo.example.com",
} as const;

export const DEMO_TIMEZONE = "Asia/Kolkata";

const TECHNICIANS = [
  { name: "Ravi Kumar", email: DEMO_EMAILS.technician, phone: "9826011001" },
  { name: "Imran Khan", email: "imran@demo.example.com", phone: "9826011002" },
  { name: "Suresh Patel", email: "suresh@demo.example.com", phone: "9826011003" },
];

const FIRST = [
  "Anita",
  "Vikram",
  "Meera",
  "Arjun",
  "Kavita",
  "Rahul",
  "Pooja",
  "Sanjay",
  "Neha",
  "Amit",
  "Divya",
  "Manoj",
  "Sunita",
  "Karan",
  "Ritu",
  "Deepak",
  "Asha",
  "Nikhil",
  "Lata",
  "Gaurav",
];
const LAST = [
  "Sharma",
  "Verma",
  "Joshi",
  "Agarwal",
  "Mehta",
  "Gupta",
  "Jain",
  "Choudhary",
  "Malviya",
  "Tiwari",
];
const STREETS = [
  "MG Road",
  "AB Road",
  "Ring Road",
  "Race Course Road",
  "Palasia Square",
  "Vijay Nagar",
  "Bhawarkuan Main Road",
  "Saket Nagar",
  "Sapna Sangeeta Road",
  "New Palasia",
];
const CITIES = [
  { city: "Indore", pincode: "4520" },
  { city: "Indore", pincode: "4520" },
  { city: "Indore", pincode: "4520" },
  { city: "Dewas", pincode: "4550" },
];
const WORK = [
  {
    title: "AC not cooling",
    notes: "Cleaned filters and coils, topped up refrigerant. Cooling normal.",
  },
  { title: "AC service (annual)", notes: "Full service done: filters, coils, drain line flushed." },
  {
    title: "Water leaking from indoor unit",
    notes: "Drain pipe was blocked. Cleared and re-sloped it.",
  },
  { title: "Geyser not heating", notes: "Replaced the thermostat. Tested, heating fine." },
  { title: "Kitchen sink blocked", notes: "Cleared the trap and the line to the main drain." },
  { title: "MCB keeps tripping", notes: "Found a short in the balcony light point. Rewired it." },
  { title: "Install new split AC", notes: "Installed 1.5 ton split AC, vacuumed and tested." },
  { title: "Ceiling fan noisy", notes: "Replaced the bearing and balanced the blades." },
  { title: "Washing machine inlet leak", notes: "Replaced the inlet hose and washer." },
  { title: "Inverter battery check", notes: "Topped up distilled water; battery health OK." },
];
const CANCEL_REASONS = [
  "Customer not at home",
  "Customer cancelled by phone",
  "Rescheduled by customer",
  "Duplicate booking",
];
// Three two-hour slots a day per technician, so seeded jobs never overlap.
const SLOTS = [
  ["09:00", "11:00"],
  ["11:30", "13:30"],
  ["14:30", "16:30"],
] as const;

/** Small deterministic PRNG, so a reset always produces the same shape of data. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoData {
  business: BusinessDoc;
  users: UserDoc[];
  customers: CustomerDoc[];
  jobs: JobDoc[];
}

/**
 * FR-DEMO-01: 1 business, 1 owner, 1 dispatcher, 3 technicians, 40 customers and about three
 * months of jobs (75 days back, 14 ahead). Seeded jobs have no photos or signature files; their
 * completion is history, not something the demo user repeats.
 */
export function generateDemoData(passwordHash: string, now = new Date()): DemoData {
  const random = prng(20261103);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const minutes = (date: Date, n: number) => new Date(date.getTime() + n * 60_000);

  const businessId = new ObjectId();
  const createdAt = addDays(now, -90);
  const user = (role: UserDoc["role"], name: string, email: string, phone: string): UserDoc => ({
    _id: new ObjectId(),
    businessId,
    name,
    email,
    phone,
    passwordHash,
    role,
    active: true,
    createdAt,
    lastLoginAt: null,
  });

  const owner = user("owner", "Priya Sharma", DEMO_EMAILS.owner, "9826010001");
  const dispatcher = user("dispatcher", "Rohit Verma", DEMO_EMAILS.dispatcher, "9826010002");
  const technicians = TECHNICIANS.map((t) => user("technician", t.name, t.email, t.phone));

  const customers: CustomerDoc[] = Array.from({ length: 40 }, (_, i) => {
    const addressCount = random() < 0.25 ? 2 : 1;
    const addresses: AddressDoc[] = Array.from({ length: addressCount }, (_, j) => {
      const place = pick(CITIES);
      return {
        _id: new ObjectId(),
        label: j === 0 ? "Home" : "Office",
        line1: `${between(1, 250)} ${pick(STREETS)}`,
        city: place.city,
        pincode: `${place.pincode}${String(between(1, 20)).padStart(2, "0")}`,
      };
    });
    return {
      _id: new ObjectId(),
      businessId,
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
      phone: `98${String(27000000 + i * 1373).padStart(8, "0")}`,
      email: i % 3 === 0 ? `customer${i + 1}@example.com` : "",
      notes: i % 5 === 0 ? "Call before arriving; gate code 2580." : "",
      addresses,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const today = dayKey(now, DEMO_TIMEZONE);
  const drafts: Omit<JobDoc, "number">[] = [];

  for (let offset = -75; offset <= 14; offset++) {
    const day = dayKey(addDays(now, offset), DEMO_TIMEZONE);
    const isSunday = new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
    for (const technician of technicians) {
      for (const [from, to] of SLOTS) {
        const isDemoTechToday = day === today && technician.email === DEMO_EMAILS.technician;
        // The demo technician always has a full day today, so "Try as Technician" shows work.
        if (!isDemoTechToday && random() > (isSunday ? 0.1 : 0.7)) continue;

        const customer = pick(customers);
        const work = pick(WORK);
        const start = new Date(zonedToIso(day, from, DEMO_TIMEZONE));
        const end = new Date(zonedToIso(day, to, DEMO_TIMEZONE));
        const created = minutes(start, -between(1, 4) * 24 * 60);
        const priority: Priority = pick(["low", "normal", "normal", "normal", "high", "urgent"]);

        let status: JobStatus;
        if (day < today) {
          const roll = random();
          status = roll < 0.9 ? "completed" : roll < 0.97 ? "cancelled" : "scheduled";
        } else if (day === today) {
          status =
            !isDemoTechToday && from === "09:00" && random() < 0.5 ? "in_progress" : "scheduled";
        } else {
          status = random() < 0.2 ? "unassigned" : "scheduled";
        }
        const assigned = status !== "unassigned";

        const history: StatusChange[] = [
          {
            from: null,
            to: assigned ? "scheduled" : "unassigned",
            byUserId: dispatcher._id,
            at: created,
          },
        ];
        let startedAt: Date | null = null;
        let completedAt: Date | null = null;
        let cancelReason: string | null = null;
        if (status === "in_progress" || status === "completed") {
          startedAt = minutes(start, between(-5, 20));
          history.push({
            from: "scheduled",
            to: "in_progress",
            byUserId: technician._id,
            at: startedAt,
          });
        }
        if (status === "completed") {
          completedAt = minutes(startedAt!, between(40, 150));
          history.push({
            from: "in_progress",
            to: "completed",
            byUserId: technician._id,
            at: completedAt,
          });
        }
        if (status === "cancelled") {
          cancelReason = pick(CANCEL_REASONS);
          history.push({
            from: "scheduled",
            to: "cancelled",
            byUserId: dispatcher._id,
            at: minutes(start, -between(30, 600)),
            reason: cancelReason,
          });
        }

        drafts.push({
          _id: new ObjectId(),
          businessId,
          customerId: customer._id,
          address: customer.addresses[0],
          customerName: customer.name,
          customerPhone: customer.phone,
          technicianId: assigned ? technician._id : null,
          title: work.title,
          description:
            priority === "urgent" ? "Customer says it's urgent, please call on the way." : "",
          priority,
          status,
          scheduledStart: start,
          scheduledEnd: end,
          startedAt,
          completedAt,
          notes: status === "completed" ? work.notes : "",
          signature: null,
          cancelReason,
          statusHistory: history,
          version: history.length - 1,
          createdBy: dispatcher._id,
          createdAt: created,
          updatedAt: history[history.length - 1].at,
        });
      }
    }
  }

  // Numbers follow booking order, like real jobs would.
  drafts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const jobs = drafts.map((job, i) => ({ ...job, number: `FO-${String(i + 1).padStart(4, "0")}` }));

  return {
    business: {
      _id: businessId,
      name: "Sharma Cooling & Repairs (Demo)",
      timezone: DEMO_TIMEZONE,
      jobCounter: jobs.length,
      isDemo: true,
      createdAt,
    },
    users: [owner, dispatcher, ...technicians],
    customers,
    jobs,
  };
}
