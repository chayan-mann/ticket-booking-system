import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Get a single booking by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get booking details' })
  getBooking(@Param('id') id: string) {
    return this.bookingsService.getBooking(id);
  }

  /**
   * Get all bookings for a user
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all bookings for a user' })
  getMyBookings(@Param('userId') userId: string) {
    return this.bookingsService.getMyBookings(userId);
  }

  /**
   * Create a new booking (starts in PENDING status)
   * Returns booking with payment instructions
   */
  @Post()
  @ApiOperation({ summary: 'Create a new booking (PENDING status)' })
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }

  /**
   * Cancel a PENDING booking
   * For CONFIRMED bookings, use the refund endpoint
   */
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending booking' })
  cancelBooking(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.bookingsService.cancelBooking(id, body.userId);
  }

  /**
   * Hold seats temporarily (5 minutes)
   * Allows user to select seats before creating booking
   */
  @Post('hold-seats')
  @ApiOperation({ summary: 'Temporarily hold seats for checkout' })
  holdSeats(
    @Body() body: { userId: string; showId: string; seatIds: string[] },
  ) {
    return this.bookingsService.holdSeats(
      body.userId,
      body.showId,
      body.seatIds,
    );
  }

  /**
   * Release all seat holds for a user
   */
  @Delete('holds/:userId')
  @ApiOperation({ summary: 'Release all seat holds for a user' })
  releaseHolds(@Param('userId') userId: string) {
    return this.bookingsService.releaseHolds(userId);
  }
}
