import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get(":id")
  getBooking(@Param("id") id: string) {
    return this.bookingsService.getBooking(id);
  }

  @Post()
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }
}
