# 🎟️ Ticket Booking System

A production-ready movie ticket booking system with **complete payment integration**, **seat hold mechanism**, and **pessimistic locking** to prevent double bookings.

## 🔄 Booking Flow Architecture

```
┌──────────────┐
│    USER      │
│  (Frontend)  │
└──────┬───────┘
       │
       │ 1. Browse Available Seats
       ▼
┌─────────────────────────────────────────────────────────────┐
│  GET /api/v1/seats/shows/{showId}?userId={userId}           │
│                                                              │
│  SeatsController → SeatsService                             │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │ PostgreSQL Query:                    │                  │
│  │ • Get all ShowSeats for show         │                  │
│  │ • JOIN with active holds             │                  │
│  │ • JOIN with PENDING/CONFIRMED bookings│                 │
│  │ • Filter: exclude booked & held      │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  Response: {                                                 │
│    seats: [{id, row, number, price, tier, status}],        │
│    summary: {available: 85, booked: 10, held: 5}           │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
       │
       │ 2. Hold Seats (Optional - 5 min lock)
       ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/v1/bookings/hold-seats                           │
│  Body: {showId, userId, showSeatIds: ["id1", "id2"]}       │
│                                                              │
│  BookingsController → BookingsService.holdSeats()           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │ Transaction:                         │                  │
│  │ 1. Check seats not already held/booked│                 │
│  │ 2. INSERT into SeatHold             │                  │
│  │    expiresAt = now() + 5 minutes    │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  Response: {                                                 │
│    success: true,                                           │
│    holds: [{seatId, expiresAt}],                           │
│    expiresIn: 300 seconds                                  │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
       │
       │ 3. Create Booking (PENDING status)
       ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/v1/bookings                                      │
│  Body: {userId, showId, showSeatIds: ["id1", "id2"]}       │
│                                                              │
│  BookingsController → BookingsService.createBooking()       │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │ 🔒 PESSIMISTIC LOCKING TRANSACTION:  │                  │
│  │                                       │                  │
│  │ 1. SELECT ... FOR UPDATE             │                  │
│  │    (Locks seat rows - prevents races)│                  │
│  │                                       │                  │
│  │ 2. Validate:                         │                  │
│  │    • Show exists & future            │                  │
│  │    • Seats exist                     │                  │
│  │    • No existing bookings on seats   │                  │
│  │                                       │                  │
│  │ 3. Calculate totalAmount             │                  │
│  │    = SUM(seat.price)                 │                  │
│  │                                       │                  │
│  │ 4. INSERT Booking:                   │                  │
│  │    status = PENDING                  │                  │
│  │    expiresAt = now() + 15 min        │                  │
│  │                                       │                  │
│  │ 5. INSERT BookingSeats               │                  │
│  │    (Link booking ↔ seats)            │                  │
│  │                                       │                  │
│  │ 6. DELETE SeatHolds for user         │                  │
│  │    (Convert holds to booking)        │                  │
│  │                                       │                  │
│  │ 7. COMMIT (or ROLLBACK on conflict)  │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  Response: {                                                 │
│    id: "booking-uuid",                                      │
│    status: "PENDING",                                       │
│    totalAmount: 500,                                        │
│    expiresAt: "2026-01-31T01:00:00Z"                       │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
       │
       │ 4. Initiate Payment
       ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/v1/payments/initiate                             │
│  Body: {bookingId, userId}                                  │
│                                                              │
│  PaymentsController → PaymentsService.initiatePayment()     │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │ 1. Validate booking is PENDING       │                  │
│  │                                       │                  │
│  │ 2. Call FakePaymentGateway:          │                  │
│  │    createPaymentSession()            │                  │
│  │    sessionId = "sess_" + uuid        │                  │
│  │                                       │                  │
│  │ 3. INSERT Payment:                   │                  │
│  │    status = PENDING                  │                  │
│  │    amount = booking.totalAmount      │                  │
│  │    gatewayRef = sessionId            │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  Response: {                                                 │
│    paymentUrl: "/payments/fake-checkout/sess_xxx",         │
│    sessionId: "sess_xxx",                                  │
│    expiresAt: "2026-01-31T01:30:00Z"                       │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
       │
       │ 5. User Completes Payment
       ▼
┌─────────────────────────────────────────────────────────────┐
│  User redirected to payment page                            │
│  Clicks "Pay Now" → Gateway processes payment               │
│                                                              │
│  POST /api/v1/payments/simulate/{sessionId} (Test Only)     │
│                        OR                                    │
│  POST /api/v1/payments/webhook (Production - from Gateway)  │
│                                                              │
│  PaymentsController → PaymentsService.handleWebhook()       │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │ 1. Verify webhook signature          │                  │
│  │    (HMAC-SHA256)                     │                  │
│  │                                       │                  │
│  │ 2. Check idempotency key             │                  │
│  │    (Prevent duplicate processing)     │                  │
│  │                                       │                  │
│  │ 3. Process based on event type:      │                  │
│  │                                       │                  │
│  │    payment.success:                  │                  │
│  │    ┌─────────────────────────────┐   │                  │
│  │    │ Transaction:                │   │                  │
│  │    │ • UPDATE Payment:           │   │                  │
│  │    │   status = SUCCESS          │   │                  │
│  │    │ • UPDATE Booking:           │   │                  │
│  │    │   status = CONFIRMED        │   │                  │
│  │    │ • DELETE SeatHolds          │   │                  │
│  │    └─────────────────────────────┘   │                  │
│  │                                       │                  │
│  │    payment.failed:                   │                  │
│  │    ┌─────────────────────────────┐   │                  │
│  │    │ • UPDATE Payment: FAILED    │   │                  │
│  │    │ • Extend booking.expiresAt  │   │                  │
│  │    │   (Give user time to retry) │   │                  │
│  │    └─────────────────────────────┘   │                  │
│  │                                       │                  │
│  │    payment.expired:                  │                  │
│  │    ┌─────────────────────────────┐   │                  │
│  │    │ • UPDATE Payment: EXPIRED   │   │                  │
│  │    │ • UPDATE Booking: EXPIRED   │   │                  │
│  │    │ • DELETE BookingSeats       │   │                  │
│  │    │   (Release seats)           │   │                  │
│  │    └─────────────────────────────┘   │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  Response: { status: "processed" }                          │
└─────────────────────────────────────────────────────────────┘
       │
       │ 6. Get Booking Confirmation
       ▼
┌─────────────────────────────────────────────────────────────┐
│  GET /api/v1/bookings/{id}                                  │
│                                                              │
│  BookingsController → BookingsService.getBooking()          │
│         │                                                    │
│         ▼                                                    │
│  Response: {                                                 │
│    id: "booking-uuid",                                      │
│    status: "CONFIRMED",                                     │
│    totalAmount: 500,                                        │
│    seats: [{row: "A", number: 1, tier: "VIP"}],           │
│    payment: {status: "SUCCESS", amount: 500},              │
│    show: {movie, theatre, startTime}                       │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│           ⏰ BACKGROUND JOBS (Running Continuously)         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Every 1 Minute:                                            │
│  ┌────────────────────────────────────────────────┐        │
│  │ BookingExpiryCronService                       │        │
│  │ 1. Find bookings: PENDING + expiresAt < now()  │        │
│  │ 2. For each expired booking:                   │        │
│  │    • DELETE BookingSeats (releases seats)      │        │
│  │    • UPDATE Booking: status = EXPIRED          │        │
│  │    • DELETE expired SeatHolds                  │        │
│  └────────────────────────────────────────────────┘        │
│                                                              │
│  Every 5 Minutes:                                           │
│  ┌────────────────────────────────────────────────┐        │
│  │ Cleanup expired SeatHolds                      │        │
│  │ DELETE FROM SeatHold WHERE expiresAt < now()   │        │
│  └────────────────────────────────────────────────┘        │
│                                                              │
│  Daily at 3 AM:                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ Archive old booking data (30+ days)            │        │
│  │ DELETE BookingSeats from EXPIRED/CANCELLED     │        │
│  │ (Keeps booking record for history)             │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Features

### 🔒 Concurrency Control

With pessimistic locking, the system guarantees:

✅ **No double booking** - Only 1 user can book a seat even with 50+ concurrent requests  
✅ **No race conditions** - Database-level locking prevents conflicts  
✅ **No concurrent writes** - Seats are locked during transaction  
✅ **No partial commits** - All-or-nothing booking guarantees

### 💳 Complete Payment Flow

- **Fake Payment Gateway** - Simulates Stripe/Razorpay for development
- **Webhook Integration** - HMAC-SHA256 signature verification
- **Idempotent Processing** - Prevents duplicate webhook handling
- **Refund Support** - Time-based refund calculations

### 🪑 Seat Hold Mechanism

- **5-minute holds** - Temporary reservations while selecting seats
- **Auto-expiry** - Automatic cleanup of expired holds
- **Visual indicators** - Shows `available`, `held`, `held_by_me`, `booked`

### ⏱️ Automated Background Jobs

- **Booking expiry** (every minute) - Auto-cancel expired PENDING bookings
- **Hold cleanup** (every 5 mins) - Remove expired seat holds
- **Data archival** (daily 3 AM) - Cleanup old booking data

### 🎯 Booking Lifecycle

```
PENDING (15 min) → Payment Success → CONFIRMED
PENDING (15 min) → Payment Failed  → Extended (retry)
PENDING (15 min) → Payment Expired → EXPIRED
PENDING (15 min) → Timeout         → EXPIRED (cron job)
PENDING          → User Cancel     → CANCELLED
CONFIRMED        → Refund Request  → REFUNDED
```

## 💻 Tech Stack

- **NestJS** 11.x - Backend framework
- **PostgreSQL** - Database with pessimistic locking
- **Prisma** 7.x - ORM with raw SQL for critical sections
- **@nestjs/schedule** - Cron job management
- **TypeScript** - Type safety

## 🚀 Complete Booking Flow

### 1️⃣ Browse Available Seats

```bash
GET /api/v1/seats/shows/{showId}?userId={userId}
```

### 2️⃣ Hold Seats (Optional - 5 min hold)

```bash
POST /api/v1/bookings/hold-seats
{
  "showId": "uuid",
  "userId": "uuid",
  "showSeatIds": ["uuid1", "uuid2"]
}
```

### 3️⃣ Create Booking (PENDING - 15 min expiry)

```bash
POST /api/v1/bookings
{
  "userId": "uuid",
  "showId": "uuid",
  "showSeatIds": ["uuid1", "uuid2"]
}
# Response: { status: "PENDING", expiresAt: "...", totalAmount: 500 }
```

### 4️⃣ Initiate Payment

```bash
POST /api/v1/payments/initiate
{
  "bookingId": "uuid",
  "userId": "uuid"
}
# Response: { paymentUrl: "...", sessionId: "sess_..." }
```

### 5️⃣ Complete Payment (redirects user to payment page)

```bash
# User completes payment on payment gateway
# Gateway sends webhook to: POST /api/v1/payments/webhook
# Booking status automatically updates to CONFIRMED
```

### 6️⃣ Check Booking Status

```bash
GET /api/v1/bookings/{id}
GET /api/v1/payments/status/{bookingId}
```

## 📋 API Endpoints

### Bookings

| Method   | Endpoint                         | Description            |
| -------- | -------------------------------- | ---------------------- |
| `POST`   | `/api/v1/bookings`               | Create PENDING booking |
| `GET`    | `/api/v1/bookings/:id`           | Get booking details    |
| `GET`    | `/api/v1/bookings/user/:userId`  | Get user's bookings    |
| `PATCH`  | `/api/v1/bookings/:id/cancel`    | Cancel PENDING booking |
| `POST`   | `/api/v1/bookings/hold-seats`    | Hold seats (5 min)     |
| `DELETE` | `/api/v1/bookings/holds/:userId` | Release seat holds     |

### Payments

| Method | Endpoint                               | Description             |
| ------ | -------------------------------------- | ----------------------- |
| `POST` | `/api/v1/payments/initiate`            | Start payment           |
| `POST` | `/api/v1/payments/webhook`             | Gateway callback        |
| `POST` | `/api/v1/payments/simulate/:sessionId` | Test payment (dev only) |
| `POST` | `/api/v1/payments/refund/:bookingId`   | Process refund          |
| `GET`  | `/api/v1/payments/status/:bookingId`   | Payment status          |

### Seats

| Method | Endpoint                                | Description                        |
| ------ | --------------------------------------- | ---------------------------------- |
| `GET`  | `/api/v1/seats/shows/:showId`           | Seat availability with hold status |
| `GET`  | `/api/v1/seats/shows/:showId/available` | Quick available seats list         |
| `GET`  | `/api/v1/seats/screens/:screenId`       | Seat layout                        |

## 🏃 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- npm/yarn

### Installation

```bash
# Install dependencies
npm install

# Setup database
npm run prisma:migrate
npm run prisma:generate

# Seed test data
npm run seed

# Start development server
npm run start:dev
```

Server runs at: `http://localhost:8001/api/v1/health`  
Swagger docs: `http://localhost:8001/api/docs`

## 🧪 Testing

### Run Concurrency Tests

```bash
npm run test:e2e -- --testPathPatterns=bookings-concurrency
```

**Test Results:**

- ✅ 10 concurrent requests → 1 success, 9 failures
- ✅ 50 concurrent requests → 1 success, 49 failures
- ✅ Different seats concurrently → All succeed
- ✅ No duplicate bookings in database

### Run All Tests

```bash
npm run test:e2e
```

## 🔐 Pessimistic Locking Implementation

The critical booking flow uses raw SQL with `FOR UPDATE` locking:

```typescript
// Locks seats during transaction to prevent concurrent booking
await tx.$executeRaw`
  SELECT 1 FROM "ShowSeat" 
  WHERE id IN (${Prisma.join(showSeatIds)}) 
  FOR UPDATE
`;
```

This ensures only **one transaction** can modify seats at a time, even with high concurrency.

## 📊 Database Schema Highlights

- **SeatHold** - Temporary 5-minute seat reservations
- **Pricing Tiers** - REGULAR, PREMIUM, VIP seats
- **Booking Statuses** - PENDING, CONFIRMED, CANCELLED, EXPIRED, REFUNDED
- **Optimized Indexes** - Fast lookups on userId, showId, status, expiresAt

See [ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md) for complete schema details.

## 📁 Project Structure

```
src/
├── modules/
│   ├── bookings/       # Booking lifecycle & seat holds
│   ├── payments/       # Payment flow & fake gateway
│   ├── seats/          # Seat availability
│   ├── shows/          # Show management
│   ├── movies/         # Movie catalog
│   └── theatres/       # Theatre & screen management
├── common/
│   ├── database/       # Prisma service
│   └── crons/          # Scheduled jobs
└── config/             # App configuration
```

## 🔧 Configuration

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/db
PORT=8001
NODE_ENV=development

# Optional: Payment gateway settings
PAYMENT_WEBHOOK_SECRET=your_webhook_secret
BOOKING_EXPIRY_MINUTES=15
SEAT_HOLD_MINUTES=5
```

## 📝 License

MIT

---

**For detailed documentation**, see [ENHANCEMENT_SUMMARY.md](ENHANCEMENT_SUMMARY.md)
