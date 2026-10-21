import { ok } from "../utils/apiResponse.js";
import { dashboardAnalytics } from "../services/analyticsService.js";

export async function analytics(req, res) {
  const departmentId = req.user.role === "DEPARTMENT_COORDINATOR" ? req.user.departmentId : undefined;
  return ok(res, "Analytics", await dashboardAnalytics({ departmentId }));
}
