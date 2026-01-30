import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/database/prisma.service";

describe("Bookings Concurrency & Pessimistic Locking (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data IDs
  let userId: string;
  let showId: string;
  let seatIds: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create a user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
      },
    });
    userId = user.id;

    // Create a movie
    const movie = await prisma.movie.create({
      data: {
        title: "Test Movie - Concurrency Test",
        durationMin: 120,
      },
    });

    // Create a theatre and screen
    const theatre = await prisma.theatre.create({
      data: {
        name: "Test Theatre",
        city: "Test City",
      },
    });

    const screen = await prisma.screen.create({
      data: {
        name: "Screen 1",
        theatreId: theatre.id,
        capacity: 10,
      },
    });

    // Create seats for the screen
    const seats = await Promise.all([
      prisma.seat.create({
        data: { screenId: screen.id, row: "A", number: 1 },
      }),
      prisma.seat.create({
        data: { screenId: screen.id, row: "A", number: 2 },
      }),
      prisma.seat.create({
        data: { screenId: screen.id, row: "A", number: 3 },
      }),
    ]);

    // Create a show
    const show = await prisma.show.create({
      data: {
        movieId: movie.id,
        screenId: screen.id,
        startTime: new Date(Date.now() + 86400000), // Tomorrow
      },
    });
    showId = show.id;

    // Create ShowSeats (available seats for this show)
    const showSeats = await Promise.all(
      seats.map((seat) =>
        prisma.showSeat.create({
          data: {
            showId: show.id,
            seatId: seat.id,
          },
        }),
      ),
    );

    seatIds = showSeats.map((ss) => ss.id);

    console.log("\n✅ Test data setup complete");
    console.log(`   User ID: ${userId}`);
    console.log(`   Show ID: ${showId}`);
    console.log(`   Seat IDs: ${seatIds.join(", ")}\n`);
  }

  async function cleanupTestData() {
    // Clean up in reverse order of foreign key dependencies
    await prisma.bookingSeat.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.showSeat.deleteMany({});
    await prisma.show.deleteMany({});
    await prisma.seat.deleteMany({});
    await prisma.screen.deleteMany({});
    await prisma.theatre.deleteMany({});
    await prisma.movie.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: "test-" } } });

    console.log("\n✅ Test data cleanup complete\n");
  }

  describe("Pessimistic Locking - Concurrent Booking Prevention", () => {
    it("should prevent double booking when 10 users try to book the same seats simultaneously", async () => {
      console.log("\n🔬 TEST: 10 concurrent requests for the same seats");
      console.log("   Expected: Only 1 success, 9 failures\n");

      // Create 10 concurrent booking requests for the SAME seats
      const concurrentRequests = 10;
      const bookingPromises = Array.from(
        { length: concurrentRequests },
        (_, i) =>
          request(app.getHttpServer())
            .post("/bookings")
            .send({
              userId,
              showId,
              seatIds: [seatIds[0], seatIds[1]], // Same 2 seats for all requests
              idempotencyKey: `concurrent-test-${i}`,
            })
            .then((res) => ({ status: res.status, body: res.body, index: i }))
            .catch((err) => ({
              status: err.status || 500,
              error: err.message,
              index: i,
            })),
      );

      const results = await Promise.all(bookingPromises);

      // Analyze results
      const successful = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status === 400 || r.status >= 400);

      console.log(`   ✅ Successful bookings: ${successful.length}`);
      console.log(`   ❌ Failed bookings: ${failed.length}`);

      if (successful.length > 0) {
        console.log(`   🎟️  Winner: Request #${successful[0].index}`);
      }

      // Assertions
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(9);

      // Verify only one booking exists in the database
      const bookingsInDb = await prisma.bookingSeat.findMany({
        where: {
          showSeatId: { in: [seatIds[0], seatIds[1]] },
        },
      });

      expect(bookingsInDb.length).toBe(2); // 2 seats in one booking

      // All BookingSeats should belong to the same booking
      const uniqueBookingIds = new Set(bookingsInDb.map((bs) => bs.bookingId));
      expect(uniqueBookingIds.size).toBe(1);

      console.log(
        `   ✅ Database verification passed: ${bookingsInDb.length} seats in 1 booking\n`,
      );
    });

    it("should allow different users to book different seats concurrently", async () => {
      console.log("\n🔬 TEST: 3 concurrent requests for DIFFERENT seats");
      console.log("   Expected: All 3 should succeed\n");

      // Clean up existing bookings first
      await prisma.bookingSeat.deleteMany({
        where: { showSeatId: { in: seatIds } },
      });
      await prisma.booking.deleteMany({
        where: { showId },
      });

      // Create 3 more seats for this test to avoid conflicts
      const screen = await prisma.show.findUnique({
        where: { id: showId },
        select: { screenId: true },
      });

      if (!screen) {
        throw new Error(`Show with id ${showId} not found`);
      }

      const newSeats = await Promise.all([
        prisma.seat.create({
          data: { screenId: screen.screenId, row: "B", number: 1 },
        }),
        prisma.seat.create({
          data: { screenId: screen.screenId, row: "B", number: 2 },
        }),
        prisma.seat.create({
          data: { screenId: screen.screenId, row: "B", number: 3 },
        }),
      ]);

      const newShowSeats = await Promise.all(
        newSeats.map((seat) =>
          prisma.showSeat.create({
            data: {
              showId: showId,
              seatId: seat.id,
            },
          }),
        ),
      );

      const newSeatIds = newShowSeats.map((ss) => ss.id);

      // Each request books a different seat
      const bookingPromises = newSeatIds.map((seatId, i) =>
        request(app.getHttpServer())
          .post("/bookings")
          .send({
            userId,
            showId,
            seatIds: [seatId], // Different seat for each request
            idempotencyKey: `different-seats-${i}`,
          })
          .then((res) => ({ status: res.status, body: res.body, seatId }))
          .catch((err) => ({
            status: err.status || 500,
            error: err.message,
            seatId,
          })),
      );

      const results = await Promise.all(bookingPromises);

      const successful = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status !== 201);

      console.log(`   ✅ Successful bookings: ${successful.length}`);
      console.log(`   ❌ Failed bookings: ${failed.length}`);

      // All should succeed since they're booking different seats
      expect(successful.length).toBe(3);
      expect(failed.length).toBe(0);

      console.log("   ✅ All different-seat bookings succeeded\n");
    });

    it("should handle race condition with 50 concurrent requests on same seats", async () => {
      console.log("\n🔬 TEST: 50 concurrent requests (stress test)");
      console.log("   Expected: Only 1 success, 49 failures\n");

      // First, cleanup any existing bookings for this show
      const existingBookings = await prisma.booking.findMany({
        where: { showId },
        select: { id: true },
      });

      await prisma.bookingSeat.deleteMany({
        where: { bookingId: { in: existingBookings.map((b) => b.id) } },
      });

      await prisma.booking.deleteMany({
        where: { id: { in: existingBookings.map((b) => b.id) } },
      });

      const concurrentRequests = 50;
      const targetSeats = [seatIds[0]]; // Just one seat for maximum contention

      const startTime = Date.now();

      const bookingPromises = Array.from(
        { length: concurrentRequests },
        (_, i) =>
          request(app.getHttpServer())
            .post("/bookings")
            .send({
              userId,
              showId,
              seatIds: targetSeats,
              idempotencyKey: `stress-test-${i}`,
            })
            .then((res) => ({ status: res.status, index: i }))
            .catch((err) => ({ status: err.status || 500, index: i })),
      );

      const results = await Promise.all(bookingPromises);
      const endTime = Date.now();

      const successful = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status !== 201);

      console.log(`   ✅ Successful bookings: ${successful.length}`);
      console.log(`   ❌ Failed bookings: ${failed.length}`);
      console.log(`   ⏱️  Completed in: ${endTime - startTime}ms`);

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(49);

      // Database integrity check
      const bookingsInDb = await prisma.bookingSeat.findMany({
        where: { showSeatId: targetSeats[0] },
      });

      expect(bookingsInDb.length).toBe(1);
      console.log("   ✅ Stress test passed - no race conditions detected\n");
    });

    it("should return proper error message when seat is already booked", async () => {
      console.log("\n🔬 TEST: Error message validation");

      // First booking should succeed
      const firstBooking = await request(app.getHttpServer())
        .post("/bookings")
        .send({
          userId,
          showId,
          seatIds: [seatIds[2]],
          idempotencyKey: `first-booking-${Date.now()}`,
        });

      expect(firstBooking.status).toBe(201);
      console.log("   ✅ First booking succeeded");

      // Second booking for same seat should fail with proper message
      const secondBooking = await request(app.getHttpServer())
        .post("/bookings")
        .send({
          userId,
          showId,
          seatIds: [seatIds[2]],
          idempotencyKey: `second-booking-${Date.now()}`,
        });

      expect(secondBooking.status).toBe(400);
      expect(secondBooking.body.message).toContain("already booked");

      console.log(
        `   ✅ Second booking failed with message: "${secondBooking.body.message}"\n`,
      );
    });
  });

  describe("Data Integrity Verification", () => {
    it("should have no duplicate seat bookings in the database", async () => {
      console.log("\n🔬 TEST: Database integrity check");

      // Query for any seats that have been booked more than once
      const duplicates = await prisma.$queryRaw<
        Array<{ showSeatId: string; count: bigint }>
      >`
        SELECT "showSeatId", COUNT(*) as count
        FROM "BookingSeat"
        GROUP BY "showSeatId"
        HAVING COUNT(*) > 1
      `;

      console.log(`   📊 Duplicate bookings found: ${duplicates.length}`);
      expect(duplicates.length).toBe(0);

      console.log("   ✅ No duplicate bookings - data integrity maintained\n");
    });

    it("should have all bookings with valid status", async () => {
      const invalidBookings = await prisma.booking.findMany({
        where: {
          status: { notIn: ["CONFIRMED", "CANCELLED"] },
        },
      });

      expect(invalidBookings.length).toBe(0);
      console.log("   ✅ All bookings have valid status\n");
    });
  });
});
