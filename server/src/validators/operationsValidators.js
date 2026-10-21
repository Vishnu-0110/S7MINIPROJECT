import { z } from "zod";

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().nonnegative().optional()
});

const severity = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const emergencySchema = z.object({
  body: z.object({
    tripId: z.string().min(1),
    message: z.string().trim().min(2).max(1000),
    severity: severity.optional(),
    location: locationSchema.optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional()
  })
});

export const breakdownSchema = z.object({
  body: z.object({
    tripId: z.string().min(1),
    message: z.string().trim().min(2).max(1000),
    severity: severity.optional(),
    location: locationSchema.optional()
  })
});

export const incidentNoteSchema = z.object({
  body: z.object({ note: z.string().trim().max(1000).optional() })
});
