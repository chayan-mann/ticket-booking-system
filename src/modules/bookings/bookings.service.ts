import { Injectable } from "@nestjs/common";
import { CreateBookingDto } from "./dto/create-booking.dto";

@Injectable()
export class BookingsService {
  getBooking(id: string) {
    // TODO: replace with Prisma query once DB is wired
    return { id };
  }

  createBooking(dto: CreateBookingDto) {
    // TODO: implement transactional seat locking with raw SQL FOR UPDATE
    // Example shape: lock seats, fail fast on conflicts, create booking + booking seats, return confirmation
    return {
      bookingId: "temp-booking-id",
      showId: dto.showId,
      seatIds: dto.seatIds,
      status: "PENDING_PAYMENT",
      idempotencyKey: dto.idempotencyKey,
    };
  }
}
