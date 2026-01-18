import { Controller, Get, Param, Query } from "@nestjs/common";
import { SeatsService } from "./seats.service";
import { SeatAvailabilityQueryDto } from "./dto/seat-availability-query.dto";

@Controller("seats")
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Get("screens/:screenId")
  listLayout(@Param("screenId") screenId: string) {
    return this.seatsService.listLayout(screenId);
  }

  @Get("shows/:showId")
  listAvailability(
    @Param("showId") showId: string,
    @Query() query: SeatAvailabilityQueryDto,
  ) {
    return this.seatsService.listAvailability(showId, query);
  }
}
