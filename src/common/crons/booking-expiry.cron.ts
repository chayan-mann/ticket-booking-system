import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "src/common/database/prisma.service";

@Injectable()
export class BookingExpiryCronService {
  private readonly logger = new Logger(BookingExpiryCronService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every minute to check for expired PENDING bookings
   * - Finds bookings where expiresAt < now AND status = PENDING
   * - Updates status to EXPIRED
   * - Deletes associated BookingSeats to release seats
   * - Deletes any remaining seat holds
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredBookings() {
    // Prevent concurrent runs
    if (this.isRunning) {
      this.logger.warn("Expiry job already running, skipping...");
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();
      this.logger.debug(
        `Checking for expired bookings at ${now.toISOString()}`,
      );

      // Find all expired PENDING bookings
      const expiredBookings = await this.prisma.booking.findMany({
        where: {
          status: "PENDING",
          expiresAt: { lt: now },
        },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
        },
      });

      if (expiredBookings.length === 0) {
        this.logger.debug("No expired bookings found");
        return;
      }

      this.logger.log(
        `Found ${expiredBookings.length} expired bookings to process`,
      );

      // Process each expired booking
      for (const booking of expiredBookings) {
        try {
          await this.expireBooking(booking.id, booking.userId);
          this.logger.log(`Expired booking ${booking.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to expire booking ${booking.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Processed ${expiredBookings.length} expired bookings`);
    } catch (error) {
      this.logger.error(`Booking expiry job failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Expire a single booking within a transaction
   */
  private async expireBooking(bookingId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Delete booking seats to release them
      await tx.bookingSeat.deleteMany({
        where: { bookingId },
      });

      // Update booking status to EXPIRED
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "EXPIRED",
          updatedAt: new Date(),
        },
      });

      // Clean up any seat holds for this user (they might have holds on other shows too)
      // We only delete holds that are already expired
      await tx.seatHold.deleteMany({
        where: {
          userId,
          expiresAt: { lt: new Date() },
        },
      });
    });
  }

  /**
   * Clean up expired seat holds (runs every 5 minutes)
   * Seat holds have a 5-minute TTL
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredSeatHolds() {
    try {
      const result = await this.prisma.seatHold.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired seat holds`);
      }
    } catch (error) {
      this.logger.error(`Seat hold cleanup failed: ${error.message}`);
    }
  }

  /**
   * Daily cleanup of old EXPIRED/CANCELLED bookings data
   * Keeps the booking record but removes the associated booking seats
   * This prevents data bloat while maintaining history
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldBookingData() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find old expired/cancelled bookings that still have booking seats
      const oldBookings = await this.prisma.booking.findMany({
        where: {
          status: { in: ["EXPIRED", "CANCELLED"] },
          updatedAt: { lt: thirtyDaysAgo },
          seats: { some: {} }, // Only if they still have seat records
        },
        select: { id: true },
      });

      if (oldBookings.length > 0) {
        const bookingIds = oldBookings.map((b) => b.id);
        const result = await this.prisma.bookingSeat.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        this.logger.log(
          `Cleaned up ${result.count} booking seats from ${oldBookings.length} old bookings`,
        );
      }
    } catch (error) {
      this.logger.error(`Daily cleanup failed: ${error.message}`);
    }
  }
}
