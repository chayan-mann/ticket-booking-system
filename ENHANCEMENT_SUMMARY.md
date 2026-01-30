# Ticket Booking System - Enhancement Summary

## 🎯 Overview

This document summarizes the major enhancements made to the ticket booking system to implement a complete payment flow, booking lifecycle management, and seat hold mechanism.

---

## 📋 New Features Implemented

### 1. Complete Payment Flow with Fake Payment Gateway

**Simulates Stripe/Razorpay behavior for development/testing:**

- **Payment Session Creation** - Creates checkout sessions with unique IDs
- **Webhook Signature Verification** - HMAC-SHA256 signature validation
- **Idempotent Event Processing** - Prevents duplicate webhook handling
- **Configurable Success Rate** - 90% success for testing edge cases
- **Refund Support** - Full and partial refunds based on time to show

### 2. Booking Lifecycle Management

**New booking states and transitions:**

```
PENDING (15 min) → Payment Success → CONFIRMED
PENDING (15 min) → Payment Failed  → Extended (retry)
PENDING (15 min) → Payment Expired → EXPIRED
PENDING (15 min) → Timeout         → EXPIRED (cron job)
PENDING          → User Cancel     → CANCELLED
CONFIRMED        → Refund Request  → REFUNDED
```

### 3. Seat Hold Mechanism

**Temporary seat reservations (5 minutes):**

- Holds seats while user completes selection
- Prevents other users from booking held seats
- Auto-expires if not converted to booking
- Visual indicators: `held`, `held_by_me`, `available`, `booked`

### 4. Automatic Booking Expiry (Cron Jobs)

**Three scheduled tasks:**

| Task                      | Interval     | Purpose                                  |
| ------------------------- | ------------ | ---------------------------------------- |
| `handleExpiredBookings`   | Every minute | Expire PENDING bookings past `expiresAt` |
| `cleanupExpiredSeatHolds` | Every 5 mins | Remove expired seat holds                |
| `cleanupOldBookingData`   | Daily 3 AM   | Archive old booking seat data (30+ days) |

### 5. Enhanced Seat Availability

**Smart filtering with status indicators:**

- Excludes seats with PENDING/CONFIRMED bookings
- Excludes seats with active holds (by other users)
- Shows user's own holds separately
- Groups by tier (REGULAR, PREMIUM, VIP) and row

### 6. Pricing Tiers

**Three seat tiers with different prices:**

- `REGULAR` - Standard seats
- `PREMIUM` - Better view/legroom
- `VIP` - Best seats in the house

---

## 🔌 New API Endpoints

### Bookings (`/api/v1/bookings`)

| Method   | Endpoint         | Description                              |
| -------- | ---------------- | ---------------------------------------- |
| `GET`    | `/:id`           | Get booking details with seats, payments |
| `GET`    | `/user/:userId`  | Get all bookings for a user              |
| `POST`   | `/`              | Create PENDING booking (15 min expiry)   |
| `PATCH`  | `/:id/cancel`    | Cancel a PENDING booking                 |
| `POST`   | `/hold-seats`    | Hold seats temporarily (5 min)           |
| `DELETE` | `/holds/:userId` | Release all seat holds for user          |

### Payments (`/api/v1/payments`)

| Method | Endpoint                    | Description                 |
| ------ | --------------------------- | --------------------------- |
| `POST` | `/initiate`                 | Start payment for a booking |
| `POST` | `/webhook`                  | Gateway webhook callback    |
| `POST` | `/simulate/:sessionId`      | Test: complete payment      |
| `POST` | `/refund/:bookingId`        | Process refund              |
| `GET`  | `/status/:bookingId`        | Get payment status          |
| `GET`  | `/fake-checkout/:sessionId` | Simulated checkout page     |

### Seats (`/api/v1/seats`)

| Method | Endpoint                   | Description                        |
| ------ | -------------------------- | ---------------------------------- |
| `GET`  | `/screens/:screenId`       | Seat layout for a screen           |
| `GET`  | `/shows/:showId`           | Availability with hold status      |
| `GET`  | `/shows/:showId/available` | Quick list of available seats only |

---

## 🗄️ Database Schema Changes

### New Model: `SeatHold`

```prisma
model SeatHold {
  id         String   @id @default(uuid())
  showSeatId String
  userId     String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  showSeat   ShowSeat @relation(fields: [showSeatId], references: [id])

  @@unique([showSeatId, userId])
  @@index([expiresAt])
  @@index([userId])
}
```

### Enhanced `ShowSeat`

```prisma
model ShowSeat {
  // ... existing fields
  price     Int       @default(250)   // Price in cents
  tier      SeatTier  @default(REGULAR)
  seatHolds SeatHold[]
}
```

### Enhanced `Booking`

```prisma
model Booking {
  // ... existing fields
  totalAmount Int?
  expiresAt   DateTime?
  updatedAt   DateTime  @default(now())
}
```

### Enhanced `Payment`

```prisma
model Payment {
  // ... existing fields
  bookingId   String
  gatewayRef  String?   // External gateway reference
  gatewayData Json?     // Full gateway response
  booking     Booking   @relation(fields: [bookingId], references: [id])
}
```

### New Enums

```prisma
enum SeatTier {
  REGULAR
  PREMIUM
  VIP
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  EXPIRED
  REFUNDED
}
```

### New Indexes

```sql
-- Performance indexes for common queries
@@index([userId]) on Booking
@@index([showId]) on Booking
@@index([status]) on Booking
@@index([expiresAt]) on Booking
@@index([showId]) on ShowSeat
@@index([expiresAt]) on SeatHold
@@index([userId]) on SeatHold
```

---

## 📁 Files Changed/Created

### New Files

| File                                                   | Purpose                                 |
| ------------------------------------------------------ | --------------------------------------- |
| `src/modules/payments/fake-payment-gateway.service.ts` | Simulates Stripe-like payment gateway   |
| `src/common/crons/booking-expiry.cron.ts`              | Scheduled tasks for booking/hold expiry |

### Modified Files

| File                                                   | Changes                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| `prisma/schema.prisma`                                 | Added SeatHold, indexes, pricing, new enums         |
| `src/app.module.ts`                                    | Added ScheduleModule, BookingExpiryCronService      |
| `src/modules/payments/payments.service.ts`             | Complete rewrite: payment flow, webhooks, refunds   |
| `src/modules/payments/payments.controller.ts`          | New endpoints for full payment lifecycle            |
| `src/modules/payments/payments.module.ts`              | Added FakePaymentGateway provider                   |
| `src/modules/payments/dto/initiate-payment.dto.ts`     | Added userId field                                  |
| `src/modules/bookings/bookings.service.ts`             | Complete rewrite: PENDING flow, holds, cancellation |
| `src/modules/bookings/bookings.controller.ts`          | New endpoints for booking lifecycle                 |
| `src/modules/seats/seats.service.ts`                   | Enhanced availability with booked/held filtering    |
| `src/modules/seats/seats.controller.ts`                | Added `/available` endpoint                         |
| `src/modules/seats/dto/seat-availability-query.dto.ts` | Added userId param                                  |
| `test/bookings-concurrency.e2e-spec.ts`                | Updated status check for new statuses               |
| `scripts/fix-prisma-esm.js`                            | Fixed ESM/CJS compatibility                         |

---

## 🚀 Complete Booking Flow

### Step 1: Browse Seats

```bash
GET /api/v1/seats/shows/{showId}?userId={userId}
```

### Step 2: Hold Seats (Optional)

```bash
POST /api/v1/bookings/hold-seats
{
  "showId": "...",
  "userId": "...",
  "showSeatIds": ["...", "..."]
}
```

### Step 3: Create Booking

```bash
POST /api/v1/bookings
{
  "userId": "...",
  "showId": "...",
  "showSeatIds": ["...", "..."]
}
# Returns: PENDING booking with 15-min expiry
```

### Step 4: Initiate Payment

```bash
POST /api/v1/payments/initiate
{
  "bookingId": "...",
  "userId": "..."
}
# Returns: paymentUrl, sessionId
```

### Step 5: Complete Payment (Test Only)

```bash
POST /api/v1/payments/simulate/{sessionId}
# Triggers webhook → booking becomes CONFIRMED
```

### Step 6: Check Status

```bash
GET /api/v1/bookings/{id}
GET /api/v1/payments/status/{bookingId}
```

---

## 🔒 Pessimistic Locking (Unchanged)

The original pessimistic locking mechanism remains intact:

```typescript
// Uses FOR UPDATE to lock seats during booking
await tx.$executeRaw`SELECT 1 FROM "ShowSeat" 
  WHERE id IN (${Prisma.join(showSeatIds)}) 
  FOR UPDATE`;
```

**Test Results:**

- ✅ 10 concurrent requests → 1 success, 9 failures
- ✅ 50 concurrent requests → 1 success, 49 failures
- ✅ Different seats concurrently → All succeed
- ✅ No duplicate bookings in database

---

## 🧪 Testing

### Run Concurrency Tests

```bash
npm run test:e2e -- --testPathPatterns=bookings-concurrency
```

### Run All E2E Tests

```bash
npm run test:e2e
```

---

## 📦 Dependencies Added

```json
{
  "@nestjs/schedule": "^5.x" // Cron job support
}
```

---

## 🔧 Configuration

### Environment Variables (Optional)

```env
# Payment Gateway (for production, replace fake gateway)
PAYMENT_GATEWAY_URL=https://api.stripe.com
PAYMENT_WEBHOOK_SECRET=whsec_...

# Booking Settings
BOOKING_EXPIRY_MINUTES=15
SEAT_HOLD_MINUTES=5
```

---

## 🛣️ Migration Applied

```bash
# Applied: 20260130184830_add_payment_flow_and_seat_holds
npm run prisma:migrate
npm run prisma:generate
```

---

## 📊 API Response Examples

### Create Booking Response

```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "status": "PENDING",
    "totalAmount": 500,
    "expiresAt": "2026-01-31T00:15:00.000Z"
  },
  "message": "Booking created. Complete payment within 15 minutes."
}
```

### Payment Initiation Response

```json
{
  "success": true,
  "paymentUrl": "http://localhost:8001/api/v1/payments/fake-checkout/sess_...",
  "sessionId": "sess_...",
  "expiresAt": "2026-01-31T00:30:00.000Z"
}
```

### Seat Availability Response

```json
{
  "showId": "uuid",
  "summary": {
    "total": 100,
    "available": 85,
    "booked": 10,
    "held": 3,
    "heldByMe": 2
  },
  "seats": [
    {
      "showSeatId": "uuid",
      "row": "A",
      "number": 1,
      "price": 250,
      "tier": "REGULAR",
      "status": "available"
    }
  ]
}
```

---

## ✅ Summary

| Feature                                 | Status         |
| --------------------------------------- | -------------- |
| Fake Payment Gateway                    | ✅ Complete    |
| Booking Lifecycle (PENDING → CONFIRMED) | ✅ Complete    |
| Webhook Signature Verification          | ✅ Complete    |
| Idempotent Webhook Handling             | ✅ Complete    |
| Seat Hold Mechanism (5 min)             | ✅ Complete    |
| Booking Expiry Cron Job                 | ✅ Complete    |
| Seat Hold Cleanup Cron                  | ✅ Complete    |
| Enhanced Seat Availability              | ✅ Complete    |
| Pricing Tiers                           | ✅ Complete    |
| Refund System                           | ✅ Complete    |
| Database Migration                      | ✅ Applied     |
| E2E Tests                               | ✅ 6/6 Passing |

---

_Generated on: January 31, 2026_
