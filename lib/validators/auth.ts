import { z } from "zod";
import { emailSchema, passwordSchema } from "./common";

export const signupSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is too short").max(100),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.output<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.output<typeof loginSchema>;

/** FR-AUTH-06 */
export const DEMO_ROLES = ["owner", "technician"] as const;
export const demoLoginSchema = z.object({ role: z.enum(DEMO_ROLES) });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password you haven't used here",
  });
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
