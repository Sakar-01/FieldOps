import { ObjectId } from "mongodb";
import type { AuthContext } from "@/lib/auth/session";
import { customersRepo, type CustomerPatch } from "@/lib/db/repositories/customers";
import type { AddressDoc, CustomerDoc } from "@/lib/db/types";
import { notFound } from "@/lib/http/errors";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "@/lib/validators/customers";

export interface AddressDto {
  id: string;
  label: string;
  line1: string;
  city: string;
  pincode: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  addresses: AddressDto[];
  createdAt: string;
  updatedAt: string;
}

function toCustomerDto(customer: CustomerDoc): CustomerDto {
  return {
    id: customer._id.toHexString(),
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    addresses: customer.addresses.map(({ _id, ...address }) => ({
      id: _id.toHexString(),
      ...address,
    })),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

function toAddressDocs(addresses: CreateCustomerInput["addresses"]): AddressDoc[] {
  return addresses.map(({ id, ...address }) => ({
    _id: id ? new ObjectId(id) : new ObjectId(),
    ...address,
  }));
}

/** FR-CUST-01, FR-CUST-02 */
export async function createCustomer(ctx: AuthContext, input: CreateCustomerInput) {
  const customer = await customersRepo.insert(ctx.businessId, {
    ...input,
    addresses: toAddressDocs(input.addresses),
  });
  return toCustomerDto(customer);
}

/** FR-CUST-03 */
export async function listCustomers(ctx: AuthContext, query: ListCustomersQuery) {
  const rows = await customersRepo.search(ctx.businessId, {
    q: query.q || undefined,
    cursor: query.cursor ? new ObjectId(query.cursor) : undefined,
    limit: query.limit,
  });
  const items = rows.slice(0, query.limit);
  return {
    items: items.map(toCustomerDto),
    nextCursor: rows.length > query.limit ? items[items.length - 1]._id.toHexString() : null,
  };
}

export async function getCustomer(ctx: AuthContext, id: ObjectId) {
  const customer = await customersRepo.findById(ctx.businessId, id);
  if (!customer) throw notFound("Customer");
  return toCustomerDto(customer);
}

export async function updateCustomer(ctx: AuthContext, id: ObjectId, input: UpdateCustomerInput) {
  const { addresses, ...fields } = input;
  const patch: CustomerPatch = { ...fields };
  if (addresses) patch.addresses = toAddressDocs(addresses);

  const customer = await customersRepo.update(ctx.businessId, id, patch);
  if (!customer) throw notFound("Customer");
  return toCustomerDto(customer);
}
