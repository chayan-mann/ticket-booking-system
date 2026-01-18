import { Injectable, BadRequestException } from "@nestjs/common";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { PrismaService } from "src/common/database/prisma.service";
import { InternalServerErrorException } from "@nestjs/common";
import { Prisma } from "src/generated/prisma/client.js";

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBooking(id: string) {
    try {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });
    return booking;
    } catch (error) {
      throw new InternalServerErrorException("Failed to get booking");
      console.error(error);
    }
  }


  async createBooking(dto: CreateBookingDto) {
    const { userId, showId, seatIds, idempotencyKey } = dto;
  
    return this.prisma.$transaction(async (tx) => {
      /**
       * 1. VALIDATE THAT ALL SHOW SEATS EXIST FOR THIS SHOW
       */
      const showSeats = await tx.showSeat.findMany({
        where: {
          id: { in: seatIds },
          showId: showId,
        },
      });

      /**
       * 2. FAIL FAST IF ANY SEAT IS MISSING OR INVALID
       */
      if (showSeats.length !== seatIds.length) {
        const foundIds = showSeats.map(s => s.id);
        const missingIds = seatIds.filter(id => !foundIds.includes(id));
        throw new BadRequestException(
          `Invalid or unavailable seats: ${missingIds.join(', ')}. Expected ${seatIds.length} seats, found ${showSeats.length}.`
        );
      }

      /**
       * 3. PESSIMISTIC LOCK ON SHOW_SEAT USING RAW SQL
       * Lock the seats we validated to prevent concurrent modifications
       * Using Prisma.join to properly handle the array
       */
      const seatIdFragments = seatIds.map(id => Prisma.sql`${id}`);
      const lockedSeats = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "ShowSeat"
        WHERE id IN (${Prisma.join(seatIdFragments, ', ')})
          AND "showId" = ${showId}
        FOR UPDATE
      `;
  
      /**
       * 4. CHECK IF ANY SEAT IS ALREADY BOOKED
       * Enforced by @@unique([showSeatId]) on BookingSeat
       */
      const existingBooking = await tx.bookingSeat.findFirst({
        where: {
          showSeatId: { in: seatIds },
        },
      });
  
      if (existingBooking) {
        throw new BadRequestException("One or more seats are already booked");
      }
  
      /**
       * 5. CREATE BOOKING
       * (PENDING will come later)
       */
      const booking = await tx.booking.create({
        data: {
          userId,
          showId,
          status: "CONFIRMED",
          paymentRef: idempotencyKey ?? crypto.randomUUID(),
        },
      });
  
      /**
       * 6. MAP SEATS TO BOOKING
       */
      await tx.bookingSeat.createMany({
        data: seatIds.map((showSeatId) => ({
          bookingId: booking.id,
          showSeatId,
        })),
      });
  
      /**
       * 7. COMMIT (implicit)
       */
      return {
        bookingId: booking.id,
        showId,
        seatIds,
        status: booking.status,
      };
    });
  }
  
}
