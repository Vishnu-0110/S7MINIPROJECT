import { z } from "zod";

export const vehicleSchema = z.object({
  body: z.object({
    registrationNumber: z.string().min(2),
    name: z.string().min(2).optional(),
    type: z.string().min(2),
    capacity: z.coerce.number().int().positive(),
    facilities: z.array(z.string().trim().min(1)).optional().default([]),
    fuelType: z.string().default("Diesel"),
    fuelLevel: z.coerce.number().min(0).max(100).default(75),
    mileageKmPerLiter: z.coerce.number().positive().default(4),
    currentKM: z.coerce.number().nonnegative().default(0),
    status: z.string().optional(),
    condition: z.string().optional(),
    nextServiceKM: z.coerce.number().optional()
  })
});

export const driverSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    licenseNumber: z.string().trim().min(2),
    phone: z.string().trim().min(5),
    address: z.string().trim().min(3)
  })
});
