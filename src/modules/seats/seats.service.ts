import { Injectable } from "@nestjs/common";
import { SeatAvailabilityQueryDto } from "./dto/seat-availability-query.dto";

@Injectable()
export class SeatsService {
  listLayout(screenId: string) {
    // TODO: replace with Prisma query once DB is wired
    return { screenId, rows: [] };
  }

  listAvailability(showId: string, query: SeatAvailabilityQueryDto) {
    // TODO: replace with Prisma query once DB is wired
    return { showId, from: query.from ?? "now", seats: [] };
  }
}
