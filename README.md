# BIT SmartFleet

BIT SmartFleet is an intelligent centralized fleet management platform for institutional transportation. It covers request approval, smart vehicle allocation, driver assignment, QR verification, trip execution, GPS/demo tracking, fuel and expense recording, maintenance, analytics, emergency handling, and AI-assisted trip requests.

This project is MongoDB Atlas first. Persistent business data is stored through Mongoose in MongoDB Atlas using `MONGO_URI`; it does not fall back to local MongoDB, JSON files, or frontend mock data.

## Project Structure

```text
client/      React + Vite + Tailwind + DaisyUI frontend
server/      Express + Mongoose + Socket.IO backend
uploads/     Runtime upload target, ignored by Git
```

## MongoDB Atlas Setup

1. Create a MongoDB Atlas account.
2. Create a cluster.
3. Create a database user.
4. Configure Network Access with your current IP address.
5. Copy the SRV connection string.
6. Create `server/.env` from `server/.env.example`.
7. Set `MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/bit_smartfleet`.
8. Set a strong `JWT_SECRET`.

If your password contains special characters, URL encode it before placing it in `MONGO_URI`.

## Install And Run

```bash
npm install
npm run install:all
npm run seed
npm run dev
```

Backend: `http://localhost:5001`

Frontend: `http://localhost:5173`

Health check: `GET http://localhost:5001/api/health`

Create `client/.env` from `client/.env.example` if your backend is not running on `http://localhost:5001`.

## Demo Accounts

The seed script creates these development users with hashed passwords:

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | superadmin@bit.edu.in | SmartFleet@123 |
| TRANSPORT_ADMIN | transportadmin@bit.edu.in | SmartFleet@123 |
| DEPARTMENT_COORDINATOR | coordinator@bit.edu.in | SmartFleet@123 |
| FACULTY_STAFF | faculty@bit.edu.in | SmartFleet@123 |
| DRIVER | driver@bit.edu.in | SmartFleet@123 |

## Required Environment

`server/.env.example` includes:

```env
PORT=5001
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/bit_smartfleet
JWT_SECRET=change_this_secret
CLIENT_URL=http://localhost:5173
AI_API_KEY=
MAP_API_KEY=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
NODE_ENV=development
DEMO_MODE=true
GPS_INTERVAL_SECONDS=20
JWT_EXPIRES_IN=7d
SEED_RESET=false
```

## MongoDB Atlas Troubleshooting

- Invalid username/password: confirm the database user and URL-encoded password.
- Wrong cluster URL: copy the latest SRV string from Atlas.
- IP not whitelisted: add your current IP in Network Access.
- Database user not created: create a user with read/write permission.
- DNS/SRV issues: try another network or confirm that `mongodb+srv` DNS is allowed.
- TLS/SSL issues: update Node.js and network certificates.
- Network restrictions: college/corporate firewalls may block Atlas.

The backend reports `MongoDB Atlas connection failed` and keeps retrying. It never silently switches to local storage.

## Main Workflows

- Faculty creates a vehicle request.
- Department coordinator approves when the trip type requires it.
- Transport admin approves and runs smart allocation.
- Allocation engine scores eligible vehicles and drivers by capacity, availability, distance efficiency, maintenance condition, and driver availability.
- Admin assigns vehicle and driver, creating a scheduled trip with a QR token.
- Driver scans/verifies QR, starts trip, records start KM and GPS.
- Socket.IO broadcasts trip, notification, emergency, and location updates.
- Driver ends trip with end KM and fuel information.
- MongoDB Atlas stores the digital trip log, fuel log, notifications, analytics source data, maintenance, expenses, and audit records.

## Implemented Modules

- Atlas-only Express backend with Mongoose connection retry and graceful shutdown.
- Authentication, JWT sessions, current-user endpoint, and strict role middleware.
- Mongoose schemas and indexes for users, departments, vehicles, drivers, requests, approvals, trips, allocations, GPS, fuel, expenses, maintenance, documents, emergencies, notifications, audit logs, and settings.
- Multi-level approval rules for local, industrial, outstation, and other trips.
- Smart allocation engine with scoring, reasons, top-three recommendations, override storage, and double-booking checks.
- Driver trip lifecycle with QR validation, start KM, end KM, fuel efficiency, vehicle/driver status changes, and Socket.IO events.
- Demo GPS and live GPS log storage.
- Emergency and breakdown flow with replacement allocation generation.
- MongoDB aggregation-backed analytics for trips, departments, vehicles, fuel, expenses, maintenance, and carbon estimate.
- AI assistant service with database-backed fallback intents and request-form parsing.
- React dashboards, request form, approval center, allocation screen, driver PWA screen, QR/trip details, live tracking, management screens, reports, notifications, analytics, and settings.
- CSV export and print-ready report view from backend data.
- Seed script with hashed demo accounts and an end-to-end demo scenario.
- Critical tests for allocation scoring and schedule overlap prevention.

## API Response Format

Success:

```json
{
  "success": true,
  "message": "Done",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Something failed",
  "errors": []
}
```

## Testing

Run:

```bash
npm test
```

The included critical tests cover allocation scoring and double-booking overlap logic. Integration tests should use a safe test Atlas database by setting a dedicated `MONGO_URI`.
