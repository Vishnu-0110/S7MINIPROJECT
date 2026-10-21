import { z } from "zod";

export const assignSchema = z.object({
  body: z.object({
    allocationId: z.string().optional(),
    vehicleId: z.string().min(1),
    driverId: z.string().min(1),
    override: z.boolean().optional(),
    overrideReason: z.string().optional()
  })
});

export const qrVerifySchema = z.object({
  body: z.object({
    qrToken: z.string().min(8)
  })
});

export const startTripSchema = z.object({
  body: z.object({
    startKM: z.coerce.number().nonnegative(),
    qrToken: z.string().optional(),
    location: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() }).optional()
  })
});

export const endTripSchema = z.object({
  body: z.object({
    endKM: z.coerce.number().nonnegative(),
    fuelUsed: z.coerce.number().nonnegative().default(0),
    actualCost: z.coerce.number().nonnegative().optional(),
    notes: z.string().optional(),
    location: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() }).optional()
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
