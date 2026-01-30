import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/common/database/prisma.service';
import { Prisma } from 'src/generated/prisma/client.js';

// Booking expires after 15 minutes if payment not completed
const BOOKING_EXPIRY_MINUTES = 15;
// Seat hold expires after 5 minutes
const SEAT_HOLD_MINUTES = 5;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a single booking by ID
   */
  async getBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        seats: {
          include: {
            showSeat: {
              include: {
                seat: true,
              },
            },
          },
        },
        show: {
          include: {
            movie: true,
            screen: {
              include: {
                theatre: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${id}`);
    }

    return booking;
  }

  /**
   * Get all bookings for a user
   */
  async getMyBookings(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: {
        seats: {
          include: {
            showSeat: {
              include: {
                seat: true,
              },
            },
          },
        },
        show: {
          include: {
            movie: true,
            screen: {
              include: {
                theatre: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings;
  }

  /**
   * Create a new booking in PENDING status
   * Uses pessimistic locking to prevent double booking
   */
  async createBooking(dto: CreateBookingDto) {
    const { userId, showId, seatIds, idempotencyKey } = dto;

    // Check for existing booking with same idempotency key
    if (idempotencyKey) {
      const existingBooking = await this.prisma.booking.findUnique({
        where: { paymentRef: idempotencyKey },
      });

      if (existingBooking) {
        this.logger.log(`Returning existing booking for idempotency key: ${idempotencyKey}`);
        return {
          bookingId: existingBooking.id,
          showId: existingBooking.showId,
          seatIds,
          status: existingBooking.status,
          expiresAt: existingBooking.expiresAt,
          totalAmount: existingBooking.totalAmount,
          message: 'Existing booking returned (idempotent)',
        };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      /**
       * 1. VALIDATE SHOW EXISTS AND HASN'T STARTED
       */
      const show = await tx.show.findUnique({
        where: { id: showId },
      });

      if (!show) {
        throw new BadRequestException(`Show not found: ${showId}`);
      }

      if (new Date() > show.startTime) {
        throw new BadRequestException('Cannot book a show that has already started');
      }

      /**
       * 2. VALIDATE THAT ALL SHOW SEATS EXIST FOR THIS SHOW
       */
      const showSeats = await tx.showSeat.findMany({
        where: {
          id: { in: seatIds },
          showId: showId,
        },
      });

      if (showSeats.length !== seatIds.length) {
        const foundIds = showSeats.map((s) => s.id);
        const missingIds = seatIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `Invalid or unavailable seats: ${missingIds.join(', ')}. Expected ${seatIds.length} seats, found ${showSeats.length}.`,
        );
      }

      /**
       * 3. PESSIMISTIC LOCK ON SHOW_SEAT USING RAW SQL
       * Lock the seats we validated to prevent concurrent modifications
       */
      const seatIdFragments = seatIds.map((id) => Prisma.sql`${id}`);
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "ShowSeat"
        WHERE id IN (${Prisma.join(seatIdFragments, ', ')})
          AND "showId" = ${showId}
        FOR UPDATE
      `;

      /**
       * 4. CHECK IF ANY SEAT IS ALREADY BOOKED (PENDING or CONFIRMED)
       */
      const existingBookingSeat = await tx.bookingSeat.findFirst({
        where: {
          showSeatId: { in: seatIds },
          booking: {
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        },
        include: {
          booking: true,
        },
      });

      if (existingBookingSeat) {
        throw new BadRequestException('One or more seats are already booked');
      }

      /**
       * 5. CHECK IF ANY SEAT HAS AN ACTIVE HOLD BY ANOTHER USER
       */
      const activeHold = await tx.seatHold.findFirst({
        where: {
          showSeatId: { in: seatIds },
          userId: { not: userId }, // Other user's hold
          expiresAt: { gt: new Date() }, // Not expired
        },
      });

      if (activeHold) {
        throw new BadRequestException(
          'One or more seats are temporarily held by another user. Please try again in a few minutes.',
        );
      }

      /**
       * 6. CALCULATE TOTAL AMOUNT
       */
      const totalAmount = showSeats.reduce((sum, seat) => sum + seat.price, 0);

      /**
       * 7. CREATE BOOKING IN PENDING STATUS
       */
      const expiresAt = new Date(Date.now() + BOOKING_EXPIRY_MINUTES * 60 * 1000);

      const booking = await tx.booking.create({
        data: {
          userId,
          showId,
          status: 'PENDING',
          paymentRef: idempotencyKey ?? crypto.randomUUID(),
          totalAmount,
          expiresAt,
        },
      });

      /**
       * 8. MAP SEATS TO BOOKING
       */
      await tx.bookingSeat.createMany({
        data: seatIds.map((showSeatId) => ({
          bookingId: booking.id,
          showSeatId,
        })),
      });

      /**
       * 9. DELETE ANY EXISTING HOLDS FOR THESE SEATS
       */
      await tx.seatHold.deleteMany({
        where: {
          showSeatId: { in: seatIds },
        },
      });

      this.logger.log(
        `Booking created: ${booking.id}, status: PENDING, expires: ${expiresAt.toISOString()}`,
      );

      return {
        bookingId: booking.id,
        showId,
        seatIds,
        status: booking.status,
        expiresAt: booking.expiresAt,
        totalAmount,
        message: 'Booking created. Please complete payment within 15 minutes.',
      };
    });
  }

  /**
   * Cancel a booking
   * Only PENDING bookings can be cancelled directly
   * CONFIRMED bookings go through refund flow
   */
  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        show: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if (booking.status === 'CANCELLED') {
      return { message: 'Booking is already cancelled', bookingId };
    }

    if (booking.status === 'CONFIRMED') {
      // For confirmed bookings, suggest refund flow
      throw new BadRequestException(
        'Confirmed bookings cannot be directly cancelled. Please use the refund endpoint.',
      );
    }

    if (!['PENDING', 'EXPIRED'].includes(booking.status)) {
      throw new BadRequestException(`Cannot cancel booking with status: ${booking.status}`);
    }

    // Cancel the booking and release seats
    await this.prisma.$transaction(async (tx) => {
      // Delete booking seats first (releases the seats)
      await tx.bookingSeat.deleteMany({
        where: { bookingId },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });
    });

    this.logger.log(`Booking cancelled: ${bookingId}`);

    return {
      bookingId,
      status: 'CANCELLED',
      message: 'Booking cancelled successfully. Seats have been released.',
    };
  }

  /**
   * Create a temporary seat hold (5 minutes)
   * Allows user to select seats before starting booking
   */
  async holdSeats(userId: string, showId: string, seatIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Validate seats exist
      const showSeats = await tx.showSeat.findMany({
        where: {
          id: { in: seatIds },
          showId,
        },
      });

      if (showSeats.length !== seatIds.length) {
        throw new BadRequestException('One or more seats are invalid');
      }

      // Check if seats are already booked
      const bookedSeat = await tx.bookingSeat.findFirst({
        where: {
          showSeatId: { in: seatIds },
          booking: {
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        },
      });

      if (bookedSeat) {
        throw new BadRequestException('One or more seats are already booked');
      }

      // Check for existing holds by other users
      const existingHold = await tx.seatHold.findFirst({
        where: {
          showSeatId: { in: seatIds },
          userId: { not: userId },
          expiresAt: { gt: new Date() },
        },
      });

      if (existingHold) {
        throw new BadRequestException('One or more seats are held by another user');
      }

      // Delete any existing holds by this user
      await tx.seatHold.deleteMany({
        where: { userId },
      });

      // Create new holds
      const expiresAt = new Date(Date.now() + SEAT_HOLD_MINUTES * 60 * 1000);

      await tx.seatHold.createMany({
        data: seatIds.map((showSeatId) => ({
          userId,
          showSeatId,
          expiresAt,
        })),
      });

      this.logger.log(`Seat hold created for user: ${userId}, seats: ${seatIds.length}`);

      return {
        userId,
        showId,
        seatIds,
        expiresAt,
        message: `Seats held for ${SEAT_HOLD_MINUTES} minutes. Please complete booking.`,
      };
    });
  }

  /**
   * Release seat holds for a user
   */
  async releaseHolds(userId: string) {
    const result = await this.prisma.seatHold.deleteMany({
      where: { userId },
    });

    return {
      released: result.count,
      message: `Released ${result.count} seat hold(s)`,
    };
  }
}
