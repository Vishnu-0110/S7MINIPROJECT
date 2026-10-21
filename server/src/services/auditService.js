import { AuditLog } from "../models/index.js";

export async function audit(actorId, action, entity, entityId, metadata = {}, before = null, after = null) {
  return AuditLog.create({ actorId, action, entity, entityId, metadata, before, after });
}
