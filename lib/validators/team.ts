import { z } from "zod";
import { emailSchema, passwordSchema, phoneSchema } from "./common";

// "owner" is deliberately absent: a business has one owner, created at signup.
export const assignableRoleSchema = z.enum(["dispatcher", "technician"]);

export const addMemberSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: emailSchema,
  phone: phoneSchema,
  role: assignableRoleSchema,
  temporaryPassword: passwordSchema,
});
export type AddMemberInput = z.output<typeof addMemberSchema>;

export const updateMemberSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    role: assignableRoleSchema,
    active: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");
export type UpdateMemberInput = z.output<typeof updateMemberSchema>;

export const listTeamQuerySchema = z.object({
  role: z.enum(["owner", "dispatcher", "technician"]).optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
