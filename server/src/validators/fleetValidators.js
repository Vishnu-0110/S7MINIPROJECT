import { z } from "zod";

export const vehicleSchema = z.object({
  body: z.object({
    vehicleId: z.string().min(2),
    registrationNumber: z.string().min(2),
    name: z.string().min(2),
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
    userId: z.string().min(1),
    driverId: z.string().min(2),
    licenseNumber: z.string().min(2),
    phone: z.string().optional(),
    assignedVehicleTypes: z.array(z.string()).optional().default([]),
    status: z.string().optional()
  })
});
