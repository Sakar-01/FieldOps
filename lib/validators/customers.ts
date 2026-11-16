import { z } from "zod";
import { emailSchema, objectIdSchema, paginationSchema, phoneSchema } from "./common";

export const addressSchema = z.object({
  // Present when editing an existing address, so its ID stays stable.
  id: objectIdSchema.optional(),
  label: z.string().trim().min(1, "Add a label, such as Home").max(50),
  line1: z.string().trim().min(3, "Enter the address").max(200),
  city: z.string().trim().min(2, "Enter the city").max(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, "Enter a valid pincode"),
});

const addressesSchema = z
  .array(addressSchema)
  .min(1, "Add at least one address")
  .max(5, "A customer can have at most 5 addresses");

const customerFields = {
  name: z.string().trim().min(2, "Name is too short").max(100),
  phone: phoneSchema,
  email: z.union([z.literal(""), emailSchema]),
  notes: z.string().trim().max(2000),
  addresses: addressesSchema,
};

export const createCustomerSchema = z.object({
  ...customerFields,
  email: customerFields.email.default(""),
  notes: customerFields.notes.default(""),
});
export type CreateCustomerInput = z.output<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object(customerFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;

export const listCustomersQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
});
export type ListCustomersQuery = z.output<typeof listCustomersQuerySchema>;
