import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  demoLoginSchema,
  loginSchema,
  signupSchema,
  changePasswordSchema,
} from "@/lib/validators/auth";
import { objectIdSchema } from "@/lib/validators/common";
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "@/lib/validators/customers";
import {
  changeStatusSchema,
  createJobSchema,
  listJobsQuerySchema,
  savePhotoSchema,
  saveSignatureSchema,
  signUploadSchema,
  updateJobSchema,
  updateNotesSchema,
} from "@/lib/validators/jobs";
import { addMemberSchema, listTeamQuerySchema, updateMemberSchema } from "@/lib/validators/team";

extendZodWithOpenApi(z);

/**
 * FR-DOCS-01: the request schemas here are the ones the handlers parse with, so the docs can't
 * drift from what the API accepts.
 */
const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "session", {
  type: "apiKey",
  in: "cookie",
  name: "fieldops_session",
  description: "httpOnly JWT cookie set by login, signup or demo login",
});

const errorSchema = registry.register(
  "Error",
  z.object({
    error: z.object({
      code: z.string().meta({ example: "JOB_OVERLAP" }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
);

const json = (schema: z.ZodType) => ({ content: { "application/json": { schema } } });
const ok = (description: string) => ({ description, ...json(z.object({}).loose()) });
const err = (description: string) => ({ description, ...json(errorSchema) });

const COMMON_ERRORS = {
  400: err("Validation failed (VALIDATION_ERROR)"),
  401: err("Not logged in (UNAUTHENTICATED)"),
  403: err("Role not allowed, or another technician's job (FORBIDDEN)"),
  429: err("Rate limit exceeded (RATE_LIMITED)"),
};

const idParams = z.object({ id: objectIdSchema });

type Roles = "Public" | "Any" | "O" | "O, D" | "O, D, T" | "T" | "Cron";

function add(
  roles: Roles,
  config: Omit<RouteConfig, "responses"> & { responses?: RouteConfig["responses"] },
) {
  const isPublic = roles === "Public" || roles === "Cron";
  registry.registerPath({
    ...config,
    description: `Roles: ${roles}${config.description ? `. ${config.description}` : ""}`,
    security: isPublic ? [] : [{ session: [] }],
    responses: { 200: ok("Success"), ...COMMON_ERRORS, ...config.responses },
  });
}

const body = (schema: z.ZodType) => ({ body: json(schema) });

// Auth
add("Public", {
  method: "post",
  path: "/api/auth/signup",
  tags: ["Auth"],
  summary: "Create a business and its owner",
  request: body(signupSchema),
  responses: { 201: ok("Created; session cookie set"), 409: err("Email already in use") },
});
add("Public", {
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  description: "5 attempts per minute per IP and email",
  request: body(loginSchema),
});
add("Public", {
  method: "post",
  path: "/api/auth/demo",
  tags: ["Auth"],
  summary: "Log in as the demo owner or technician",
  request: body(demoLoginSchema),
});
add("Any", {
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Clear the session cookie",
});
add("Any", {
  method: "get",
  path: "/api/me",
  tags: ["Auth"],
  summary: "Current user and business",
});
add("Any", {
  method: "post",
  path: "/api/me/password",
  tags: ["Auth"],
  summary: "Change your password",
  description: "Not available to demo users",
  request: body(changePasswordSchema),
});

// Team
add("O, D", {
  method: "get",
  path: "/api/team",
  tags: ["Team"],
  summary: "List team members",
  request: { query: listTeamQuerySchema },
});
add("O", {
  method: "post",
  path: "/api/team",
  tags: ["Team"],
  summary: "Add a technician or dispatcher",
  request: body(addMemberSchema),
  responses: { 201: ok("Created") },
});
add("O", {
  method: "patch",
  path: "/api/team/{id}",
  tags: ["Team"],
  summary: "Update name, phone, role or active",
  request: { params: idParams, ...body(updateMemberSchema) },
});

// Customers
add("O, D", {
  method: "get",
  path: "/api/customers",
  tags: ["Customers"],
  summary: "Search customers (cursor pagination)",
  request: { query: listCustomersQuerySchema },
});
add("O, D", {
  method: "post",
  path: "/api/customers",
  tags: ["Customers"],
  summary: "Create a customer",
  request: body(createCustomerSchema),
  responses: { 201: ok("Created") },
});
add("O, D", {
  method: "get",
  path: "/api/customers/{id}",
  tags: ["Customers"],
  summary: "Customer with addresses",
  request: { params: idParams },
});
add("O, D", {
  method: "patch",
  path: "/api/customers/{id}",
  tags: ["Customers"],
  summary: "Update a customer or its addresses",
  request: { params: idParams, ...body(updateCustomerSchema) },
});

// Jobs
add("O, D, T", {
  method: "get",
  path: "/api/jobs",
  tags: ["Jobs"],
  summary: "List jobs with filters",
  description: "Technicians only get their own jobs",
  request: { query: listJobsQuerySchema },
});
add("O, D", {
  method: "post",
  path: "/api/jobs",
  tags: ["Jobs"],
  summary: "Create a job",
  description: "Runs the overlap check when a technician is set",
  request: body(createJobSchema),
  responses: { 201: ok("Created"), 409: err("JOB_OVERLAP: the technician is booked then") },
});
add("O, D, T", {
  method: "get",
  path: "/api/jobs/{id}",
  tags: ["Jobs"],
  summary: "Job detail with photos and history",
  request: { params: idParams },
  responses: { 404: err("Not found in this business") },
});
add("O, D", {
  method: "patch",
  path: "/api/jobs/{id}",
  tags: ["Jobs"],
  summary: "Edit, assign or reschedule",
  description: "Send the version you loaded",
  request: { params: idParams, ...body(updateJobSchema) },
  responses: { 409: err("VERSION_CONFLICT, JOB_OVERLAP or INVALID_TRANSITION") },
});
add("O, D, T", {
  method: "post",
  path: "/api/jobs/{id}/status",
  tags: ["Jobs"],
  summary: "Start, complete or cancel",
  description: "Enforces the state machine",
  request: { params: idParams, ...body(changeStatusSchema) },
  responses: {
    409: err("INVALID_TRANSITION"),
    422: err("PRECONDITION_FAILED: photo, signature or reason missing"),
  },
});
add("T", {
  method: "patch",
  path: "/api/jobs/{id}/notes",
  tags: ["Jobs"],
  summary: "Update work notes on your own job",
  request: { params: idParams, ...body(updateNotesSchema) },
});
add("O, D, T", {
  method: "post",
  path: "/api/jobs/{id}/photos",
  tags: ["Uploads"],
  summary: "Save photo metadata after uploading",
  request: { params: idParams, ...body(savePhotoSchema) },
  responses: { 201: ok("Saved") },
});
add("O, D, T", {
  method: "delete",
  path: "/api/jobs/{id}/photos/{photoId}",
  tags: ["Uploads"],
  summary: "Remove a photo (not after completion)",
  request: { params: z.object({ id: objectIdSchema, photoId: objectIdSchema }) },
  responses: { 204: { description: "Removed" } },
});
add("T", {
  method: "put",
  path: "/api/jobs/{id}/signature",
  tags: ["Uploads"],
  summary: "Save the customer's signature",
  request: { params: idParams, ...body(saveSignatureSchema) },
});
add("O, D, T", {
  method: "get",
  path: "/api/jobs/{id}/report",
  tags: ["Jobs"],
  summary: "PDF report for a completed job",
  request: { params: idParams },
  responses: {
    200: {
      description: "PDF",
      content: { "application/pdf": { schema: z.string().meta({ format: "binary" }) } },
    },
    422: err("The job isn't completed"),
  },
});
add("T", {
  method: "get",
  path: "/api/tech/today",
  tags: ["Jobs"],
  summary: "Today's jobs for the logged-in technician",
});
add("O, D, T", {
  method: "post",
  path: "/api/uploads/sign",
  tags: ["Uploads"],
  summary: "Signed params for one direct upload",
  description: "30 per minute per user; valid for 10 minutes",
  request: body(signUploadSchema),
});

// Other
add("O, D", {
  method: "get",
  path: "/api/dashboard",
  tags: ["Dashboard"],
  summary: "Dashboard summary (one $facet aggregation)",
});
add("Cron", {
  method: "get",
  path: "/api/cron/daily",
  tags: ["System"],
  summary: "Reset the demo business and remove orphan uploads",
  description: "Needs Authorization: Bearer CRON_SECRET",
  security: [],
});
add("Public", { method: "get", path: "/api/openapi", tags: ["System"], summary: "This document" });

let cached: ReturnType<OpenApiGeneratorV3["generateDocument"]> | undefined;

export function openApiDocument() {
  cached ??= new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "FieldOps API",
      version: "1.0.0",
      description:
        "Work orders for field-service businesses. Errors always use the Error shape. Times are UTC ISO 8601.",
    },
    servers: [{ url: "/" }],
  });
  return cached;
}
