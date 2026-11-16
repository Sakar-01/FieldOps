import type { ObjectId } from "mongodb";
import type { JobStatus } from "@/lib/domain/job-status";

export const ROLES = ["owner", "dispatcher", "technician"] as const;
export type Role = (typeof ROLES)[number];

export interface BusinessDoc {
  _id: ObjectId;
  name: string;
  timezone: string;
  jobCounter: number;
  isDemo: boolean;
  createdAt: Date;
}

export interface UserDoc {
  _id: ObjectId;
  businessId: ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Bumped inside every booking transaction, so concurrent bookings for one technician conflict. */
  scheduleVersion?: number;
}

export interface AddressDoc {
  _id: ObjectId;
  label: string;
  line1: string;
  city: string;
  pincode: string;
}

export interface CustomerDoc {
  _id: ObjectId;
  businessId: ObjectId;
  name: string;
  phone: string;
  email: string;
  notes: string;
  addresses: AddressDoc[];
  createdAt: Date;
  updatedAt: Date;
}

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface StatusChange {
  from: JobStatus | null;
  to: JobStatus;
  byUserId: ObjectId;
  at: Date;
  reason?: string;
}

export interface SignatureDoc {
  key: string;
  url: string;
  signedAt: Date;
}

export interface JobDoc {
  _id: ObjectId;
  businessId: ObjectId;
  number: string;
  customerId: ObjectId;
  /** A copy taken when the job is created, so later edits to the customer don't rewrite history. */
  address: AddressDoc;
  customerName: string;
  customerPhone: string;
  technicianId: ObjectId | null;
  title: string;
  description: string;
  priority: Priority;
  status: JobStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string;
  signature: SignatureDoc | null;
  cancelReason: string | null;
  statusHistory: StatusChange[];
  version: number;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const PHOTO_KINDS = ["before", "after"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export interface PhotoDoc {
  _id: ObjectId;
  businessId: ObjectId;
  jobId: ObjectId;
  kind: PhotoKind;
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  uploadedBy: ObjectId;
  createdAt: Date;
}
