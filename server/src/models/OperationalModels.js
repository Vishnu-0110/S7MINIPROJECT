import mongoose from "mongoose";

const fileField = { path: String, originalName: String, mimeType: String, size: Number };

const maintenanceSchema = new mongoose.Schema(
  {
    maintenanceId: { type: String, required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    type: String,
    serviceDate: Date,
    nextServiceKM: Number,
    intervalKM: Number,
    intervalMonths: Number,
    currentKM: Number,
    risk: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
    status: { type: String, enum: ["SCHEDULED", "COMPLETED", "OVERDUE", "BREAKDOWN"], default: "SCHEDULED" },
    notes: String,
    cost: Number
  },
  { timestamps: true, collection: "maintenance" }
);
maintenanceSchema.index({ vehicleId: 1 });
maintenanceSchema.index({ nextServiceKM: 1 });
maintenanceSchema.index({ serviceDate: 1 });

const fuelLogSchema = new mongoose.Schema(
  {
    fuelLogId: { type: String, required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    date: { type: Date, default: Date.now },
    quantity: Number,
    pricePerLiter: Number,
    totalAmount: Number,
    odometerReading: Number,
    fuelStation: String,
    receipt: fileField,
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    efficiency: Number,
    abnormal: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "fuel_logs" }
);
fuelLogSchema.index({ vehicleId: 1 });
fuelLogSchema.index({ tripId: 1 });
fuelLogSchema.index({ date: 1 });

const expenseSchema = new mongoose.Schema(
  {
    expenseId: { type: String, required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    category: { type: String, required: true },
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    notes: String,
    receipt: fileField,
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true, collection: "expenses" }
);
expenseSchema.index({ vehicleId: 1 });
expenseSchema.index({ tripId: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ date: 1 });

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: String,
    message: String,
    type: { type: String, default: "INFO" },
    isRead: { type: Boolean, default: false },
    metadata: Object
  },
  { timestamps: true, collection: "notifications" }
);
notificationSchema.index({ userId: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const gpsLogSchema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    latitude: Number,
    longitude: Number,
    speed: Number,
    accuracy: Number,
    timestamp: { type: Date, default: Date.now },
    demoMode: { type: Boolean, default: false }
  },
  { timestamps: true, collection: "gps_logs" }
);
gpsLogSchema.index({ tripId: 1 });
gpsLogSchema.index({ vehicleId: 1 });
gpsLogSchema.index({ timestamp: -1 });

const emergencyAlertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "VehicleRequest" },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reporterRole: String,
    kind: { type: String, enum: ["EMERGENCY", "BREAKDOWN"], default: "EMERGENCY" },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "HIGH" },
    message: String,
    status: { type: String, enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"], default: "OPEN" },
    location: Object,
    lastKnownLocation: Object,
    idempotencyKey: { type: String, sparse: true, unique: true },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acknowledgedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
    resolutionNotes: String,
    silencedBy: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now } }],
    events: [{ action: String, actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, note: String, at: { type: Date, default: Date.now } }]
  },
  { timestamps: true, collection: "emergency_alerts" }
);
emergencyAlertSchema.index({ tripId: 1 });
emergencyAlertSchema.index({ vehicleId: 1 });
emergencyAlertSchema.index({ status: 1 });
emergencyAlertSchema.index({ createdAt: -1 });
emergencyAlertSchema.index({ kind: 1, status: 1, createdAt: -1 });

const vehicleDocumentSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, unique: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    vehicleType: String,
    type: String,
    number: String,
    expiresAt: Date,
    file: fileField
  },
  { timestamps: true, collection: "vehicle_documents" }
);
vehicleDocumentSchema.index({ vehicleId: 1 });
vehicleDocumentSchema.index({ expiresAt: 1 });

const driverIncidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
    description: String,
    status: { type: String, enum: ["OPEN", "REVIEWED", "CLOSED"], default: "OPEN" }
  },
  { timestamps: true, collection: "driver_incidents" }
);
driverIncidentSchema.index({ driverId: 1 });
driverIncidentSchema.index({ tripId: 1 });

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entity: String,
    entityId: mongoose.Schema.Types.ObjectId,
    before: Object,
    after: Object,
    metadata: Object
  },
  { timestamps: true, collection: "audit_logs" }
);
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

export const Maintenance = mongoose.model("Maintenance", maintenanceSchema);
export const FuelLog = mongoose.model("FuelLog", fuelLogSchema);
export const Expense = mongoose.model("Expense", expenseSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
export const GpsLog = mongoose.model("GpsLog", gpsLogSchema);
export const EmergencyAlert = mongoose.model("EmergencyAlert", emergencyAlertSchema);
export const VehicleDocument = mongoose.model("VehicleDocument", vehicleDocumentSchema);
export const DriverIncident = mongoose.model("DriverIncident", driverIncidentSchema);
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
