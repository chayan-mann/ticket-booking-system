import { Injectable } from "@nestjs/common";
import { SeatAvailabilityQueryDto } from "./dto/seat-availability-query.dto";
import { PrismaService } from "src/common/database/prisma.service";
import { Seat } from "src/generated/prisma/client.js";
import { InternalServerErrorException } from "@nestjs/common";
@Injectable()
export class SeatsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLayout(screenId: string) {
    try {
      const layout = await this.prisma.seat.findMany({
      where: { screenId },
    });
      return layout;
    } catch (error) {
      throw new InternalServerErrorException("Failed to list layout");
      console.error(error);
    }
  }

  async listAvailability(showId: string, query: SeatAvailabilityQueryDto) {
    try {
    const availability = await this.prisma.seat.findMany({
      where: { showSeats: { some: { showId } } },
      });
      return availability;
    } catch (error) {
      throw new InternalServerErrorException("Failed to list availability");
      console.error(error);
    }
  }
}
