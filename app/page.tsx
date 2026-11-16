import {
  BookOpenIcon,
  Building2Icon,
  CalendarClockIcon,
  CameraIcon,
  ClockIcon,
  ClipboardListIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  MapPinIcon,
  PenLineIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoButtons } from "@/components/auth/demo-buttons";
import { StatusBadge } from "@/components/jobs/status-badge";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/domain/job-status";
import { cn } from "cn";

export const metadata: Metadata = {
  title: { absolute: "FieldOps: work orders for field-service teams" },
  description:
    "Schedule jobs, dispatch technicians and capture photo and signature proof of work, from the office and the phone.",
};

type Feature = { icon: LucideIcon; title: string; body: string };

const OFFICE_FEATURES: Feature[] = [
  {
    icon: ClipboardListIcon,
    title: "Work orders",
    body: "Create jobs with a customer, address, priority and time window. Search and filter by status, technician, customer or day.",
  },
  {
    icon: CalendarClockIcon,
    title: "No double-booking",
    body: "Assigning or rescheduling checks the technician's calendar, so two jobs can never overlap, even when two dispatchers click at once.",
  },
  {
    icon: UsersIcon,
    title: "Customers and addresses",
    body: "Keep every customer with several service addresses and their full job history, searchable by name or phone.",
  },
  {
    icon: GaugeIcon,
    title: "Dashboard",
    body: "Today's jobs, overdue work, completions per technician and average time to complete, at a glance.",
  },
  {
    icon: FileTextIcon,
    title: "PDF job reports",
    body: "One click turns a completed job into a report with notes, photos and the customer's signature.",
  },
  {
    icon: HistoryIcon,
    title: "Full status history",
    body: "Every change records who made it and when, and edits made at the same time are caught instead of overwritten.",
  },
];

const FIELD_FEATURES: Feature[] = [
  {
    icon: SmartphoneIcon,
    title: "Today on one screen",
    body: "Technicians open the app and see their jobs for the day in order, built for phones with large touch targets.",
  },
  {
    icon: MapPinIcon,
    title: "One-tap directions",
    body: "Open the job address straight in the phone's maps app, and call the customer from the job card.",
  },
  {
    icon: CameraIcon,
    title: "Before and after photos",
    body: "Photos are compressed on the phone before upload, so they go through even on a weak mobile connection.",
  },
  {
    icon: PenLineIcon,
    title: "Customer signature",
    body: "The customer signs on screen to confirm the work. A job can't be completed without proof.",
  },
];

const PLATFORM_FEATURES: Feature[] = [
  {
    icon: Building2Icon,
    title: "Your business, kept separate",
    body: "Each business sees only its own data. Technicians see only the jobs assigned to them.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Roles that fit the team",
    body: "Owners manage the team, dispatchers plan the work, technicians do it. Deactivated users lose access immediately.",
  },
  {
    icon: ClockIcon,
    title: "Your local time",
    body: "Times are stored precisely and always shown in your business's time zone, wherever people log in from.",
  },
  {
    icon: BookOpenIcon,
    title: "Documented API",
    body: "Every endpoint is described in interactive API docs, ready for integrations.",
  },
];

const LIFECYCLE: JobStatus[] = ["unassigned", "scheduled", "in_progress", "completed"];

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    // Four cards sit in one row; six in two rows of three, so no row is left with one card.
    <ul
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        features.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {features.map(({ icon: Icon, title, body }) => (
        <li key={title} className="bg-card rounded-xl border p-5">
          <Icon className="text-primary mb-3 size-5" aria-hidden />
          <h3 className="font-medium">{title}</h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="py-14 sm:py-20">
      <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 max-w-2xl">{intro}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

// proxy.ts sends signed-in users to their own home, so only visitors see this page.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <WrenchIcon className="size-5" aria-hidden />
            FieldOps
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="#features">Features</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Work orders for small field-service teams
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-balance">
            Plan and dispatch jobs from the office. Technicians see their day on their phone and
            close each job with photos and the customer&apos;s signature.
          </p>
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">Create your business account</Link>
            </Button>
            <DemoButtons variant="outline" size="lg" />
            <p className="text-muted-foreground text-sm">
              The demo opens a sample business with customers, jobs and a technician&apos;s day. No
              sign-up needed.
            </p>
          </div>
        </section>

        <section aria-labelledby="lifecycle-title" className="bg-muted/40 rounded-2xl border p-6">
          <h2 id="lifecycle-title" className="font-medium">
            Every job follows the same path
          </h2>
          <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {LIFECYCLE.map((status, i) => (
              <li key={status} className="flex items-center gap-3">
                <StatusBadge status={status} />
                {i < LIFECYCLE.length - 1 && (
                  <span className="text-muted-foreground" aria-hidden>
                    &rarr;
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-3 text-sm">
            Assigning a technician schedules the job, the technician starts and completes it on
            site, and an office user can cancel it at any point before it is completed.
          </p>
        </section>

        <div id="features" className="scroll-mt-14">
          <Section
            id="office"
            eyebrow="For owners and dispatchers"
            title="Run the schedule from the office"
            intro="Everything needed to take a call, book the job and know it got done."
          >
            <FeatureGrid features={OFFICE_FEATURES} />
          </Section>

          <Section
            id="field"
            eyebrow="For technicians"
            title="A phone app for the job site"
            intro="Technicians get only what they need on site: where to go, what to do, and how to prove it's done."
          >
            <FeatureGrid features={FIELD_FEATURES} />
          </Section>

          <Section
            id="platform"
            eyebrow="Under the hood"
            title="Built for teams that share one system"
            intro="Several businesses, several roles, one app, with the data kept apart."
          >
            <FeatureGrid features={PLATFORM_FEATURES} />
          </Section>
        </div>

        <section className="mb-16 rounded-2xl border p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight">See it with real data</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl">
            Open the demo as an owner to see the dashboard and schedule, or as a technician to see
            the phone view.
          </p>
          <DemoButtons className="mx-auto mt-6 max-w-md" size="lg" />
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm">
          <span>FieldOps</span>
          <nav className="flex gap-4">
            <Link href="/api-docs" className="hover:text-foreground">
              API docs
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
