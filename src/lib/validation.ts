import { z } from "zod";

/**
 * Zod schema for the POST /identify request body.
 * - email: optional nullable string, must be valid email if provided
 * - phoneNumber: optional nullable string or number, coerced to string
 * - At least one of email or phoneNumber must be provided
 */
export const identifySchema = z
    .object({
        email: z.string().email("Invalid email format").nullable().optional(),
        phoneNumber: z
            .union([z.string(), z.number()])
            .nullable()
            .optional()
            .transform((val) => (val != null ? String(val) : null)),
    })
    .refine((data) => data.email || data.phoneNumber, {
        message: "At least one of email or phoneNumber must be provided",
    });

export type IdentifyInput = z.infer<typeof identifySchema>;
