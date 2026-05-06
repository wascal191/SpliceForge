import { z } from "zod";

// Hard cap to prevent storage abuse / DoS (V-08).
const MAX_JSON_BYTES = 256_000;
export const limitedJson = z
  .record(z.unknown())
  .refine((v) => JSON.stringify(v).length <= MAX_JSON_BYTES, {
    message: "Payload too large",
  });

export const Uuid = z.string().uuid();

export const RoleEnum = z.enum(["owner", "editor", "viewer"]);
export const InvitableRole = z.enum(["editor", "viewer"]);
export const Email = z.string().trim().toLowerCase().email().max(254);

export const HumanName = z.string().trim().min(1).max(120);
export const OrgName = z.string().trim().min(1).max(120);
// Loose phone: digits, spaces, dashes, parens, plus. Optional.
export const Phone = z.string().trim().max(32).regex(/^[+0-9 ()\-]*$/, "Invalid phone");

export const ProjectName = z.string().trim().min(1).max(200);
export const ProjectDescription = z.string().trim().max(2000);

export const BedsheetName = z.string().trim().min(1).max(200);
export const PageTitle = z.string().trim().max(200);
export const ElementLabel = z.string().trim().max(200);
export const PortLabel = z.string().trim().max(200).nullable();
export const ColorString = z.string().trim().max(64);

export const ElementType = z.enum(["cable", "splitter", "equipment", "closure"]);
export const PortStatus = z.enum(["occupied", "unoccupied"]);

export const ElementUpdate = z
  .object({
    label: ElementLabel.optional(),
    position_x: z.number().finite().optional(),
    position_y: z.number().finite().optional(),
    config_json: limitedJson.optional(),
  })
  .strict();

export const ProjectUpdate = z
  .object({
    name: ProjectName.optional(),
    description: ProjectDescription.optional(),
  })
  .strict();

export const SpliceUpdate = z
  .object({
    comment: z.string().trim().max(2000).optional(),
    color: ColorString.optional(),
  })
  .strict();

export const LibraryCableInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    fiberCount: z.number().int().min(1).max(2048),
    colorScheme: z.string().trim().min(1).max(64),
    moduleFiberCount: z.number().int().min(1).max(2048).optional(),
  })
  .strict();

export const PageDataJson = limitedJson;

/**
 * Tiny helper that throws a clean public error when validation fails, but
 * still logs the underlying issues server-side.
 */
export function parseOrFail<T extends z.ZodTypeAny>(schema: T, value: unknown, scope: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error(`[validation:${scope}]`, result.error.flatten());
    throw new Error("Invalid request");
  }
  return result.data;
}
