import { z } from "zod";
import { PRIORITIES, TRIP_TYPES } from "../models/index.js";

export const requestCreateSchema = z.object({
  body: z.object({
    tripType: z.enum(TRIP_TYPES),
    purpose: z.string().min(3),
    source: z.string().min(2),
    destination: z.string().min(2),
    waypoints: z.array(z.string()).optional().default([]),
    passengerCount: z.coerce.number().int().positive(),
    passengers: z.array(z.object({ name: z.string().optional(), rollNo: z.string().optional(), phone: z.string().optional() })).optional(),
    date: z.coerce.date(),
    departureTime: z.coerce.date(),
    returnTime: z.coerce.date(),
    priority: z.enum(PRIORITIES).default("Normal"),
    specialRequirements: z.string().optional(),
    notes: z.string().optional()
  }).superRefine((data, ctx) => {
    if (data.returnTime <= data.departureTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["returnTime"], message: "Return time must be after departure time." });
    }
    if (data.departureTime <= new Date()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departureTime"], message: "Departure time must be in the future." });
    }
  })
});

export const approveSchema = z.object({
  body: z.object({
    comments: z.string().optional()
  })
});

export const rejectSchema = z.object({
  body: z.object({
    comments: z.string().min(2)
  })
});
