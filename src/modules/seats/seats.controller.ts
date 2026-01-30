import { Controller, Get, Param, Query } from "@nestjs/common";
import { SeatsService } from "./seats.service";
import { SeatAvailabilityQueryDto } from "./dto/seat-availability-query.dto";

@Controller("seats")
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  /**
   * Get seat layout for a screen (no availability info)
   */
  @Get("screens/:screenId")
  listLayout(@Param("screenId") screenId: string) {
    return this.seatsService.listLayout(screenId);
  }

  /**
   * Get seat availability for a show (includes booking/hold status)
   * Pass userId query param to see your own holds
   */
  @Get("shows/:showId")
  listAvailability(
    @Param("showId") showId: string,
    @Query() query: SeatAvailabilityQueryDto,
  ) {
    return this.seatsService.listAvailability(showId, query);
  }

  /**
   * Quick endpoint to get only available seats for a show
   */
  @Get("shows/:showId/available")
  getAvailableSeats(@Param("showId") showId: string) {
    return this.seatsService.getAvailableSeats(showId);
  }
}
