import { Injectable } from "@nestjs/common";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { PrismaService } from "src/common/database/prisma.service";
import { InternalServerErrorException } from "@nestjs/common";

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
       * 1. PESSIMISTIC LOCK ON SHOW_SEAT
       */
      const lockedSeats = await tx.$queryRaw<
        { id: string }[]
      >`
        SELECT id
        FROM "ShowSeat"
        WHERE id = ANY(${seatIds})
          AND "showId" = ${showId}
        FOR UPDATE
      `;
  
      /**
       * 2. FAIL FAST IF ANY SEAT IS MISSING
       */
      if (lockedSeats.length !== seatIds.length) {
        throw new Error("One or more seats are invalid or unavailable");
      }
  
      /**
       * 3. CHECK IF ANY SEAT IS ALREADY BOOKED
       * Enforced by @@unique([showSeatId]) on BookingSeat
       */
      const existingBooking = await tx.bookingSeat.findFirst({
        where: {
          showSeatId: { in: seatIds },
        },
      });
  
      if (existingBooking) {
        throw new Error("One or more seats already booked");
      }
  
      /**
       * 4. CREATE BOOKING
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
       * 5. MAP SEATS TO BOOKING
       */
      await tx.bookingSeat.createMany({
        data: seatIds.map((showSeatId) => ({
          bookingId: booking.id,
          showSeatId,
        })),
      });
  
      /**
       * 6. COMMIT (implicit)
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
