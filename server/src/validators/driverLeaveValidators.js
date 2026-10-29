import { z } from "zod";

export const driverLeaveCreateSchema = z.object({
  body: z.object({
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: z.string().trim().min(3).max(1000)
  })
});

export const driverLeaveDecisionSchema = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    reviewNote: z.string().trim().max(1000).optional()
  })
});
