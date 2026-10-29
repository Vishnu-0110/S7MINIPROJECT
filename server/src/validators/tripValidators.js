import { z } from "zod";

export const assignSchema = z.object({
  body: z.object({
    allocationId: z.string().optional(),
    vehicleId: z.string().min(1),
    driverId: z.string().min(1),
    override: z.boolean().optional(),
    overrideReason: z.string().trim().min(2).max(1000).optional()
  }).superRefine((data, ctx) => {
    if (data.override && !data.overrideReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["overrideReason"], message: "An override reason is required." });
    }
  })
});

export const qrVerifySchema = z.object({
  body: z.object({
    qrToken: z.string().min(8)
  })
});

export const startTripSchema = z.object({
  body: z.object({
    startKM: z.coerce.number().finite().nonnegative(),
    qrToken: z.string().min(8, "Scan and verify the trip QR code before starting."),
    location: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() }).optional()
  })
});

export const endTripSchema = z.object({
  body: z.object({
    endKM: z.coerce.number().finite().nonnegative(),
    location: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() }).optional()
  })
});

export const tripCompletionSchema = z.object({
  body: z.object({
    qrToken: z.string().min(8),
    rating: z.coerce.number().int().min(1).max(5),
    feedback: z.string().trim().max(1000).optional()
  })
});

export const gpsSchema = z.object({
  body: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    speed: z.coerce.number().nonnegative().optional(),
    accuracy: z.coerce.number().nonnegative().optional(),
    demoMode: z.boolean().optional()
  })
});
