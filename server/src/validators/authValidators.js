import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    role: z.enum(["FACULTY_STAFF", "DRIVER"]).default("FACULTY_STAFF"),
    departmentId: z.string().optional(),
    phone: z.string().optional(),
    licenseNumber: z.string().min(2).optional()
  }).superRefine((data, ctx) => {
    if (data.role === "DRIVER" && !data.licenseNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["licenseNumber"], message: "A licence number is required for a driver account" });
    }
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1)
  })
});
