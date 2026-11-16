import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ID");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

// Stored without spaces or dashes, so a search for a number matches however it was typed.
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, "Enter a valid phone number"));

// bcrypt only reads the first 72 bytes, so longer passwords would be silently truncated.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password is too long");

export const paginationSchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
