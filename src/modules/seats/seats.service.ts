import { Injectable, Logger } from '@nestjs/common';
import { SeatAvailabilityQueryDto } from './dto/seat-availability-query.dto';
import { PrismaService } from 'src/common/database/prisma.service';

@Injectable()
export class SeatsService {
  private readonly logger = new Logger(SeatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List seat layout for a screen
   */
  async listLayout(screenId: string) {
    const layout = await this.prisma.seat.findMany({
      where: { screenId },
      orderBy: [{ row: 'asc' }, { number: 'asc' }],
    });

    // Group by row for better display
    const groupedByRow = layout.reduce(
      (acc, seat) => {
        if (!acc[seat.row]) {
          acc[seat.row] = [];
        }
        acc[seat.row].push(seat);
        return acc;
      },
      {} as Record<string, typeof layout>,
    );

    return {
      screenId,
      totalSeats: layout.length,
      rows: Object.keys(groupedByRow).sort(),
      layout: groupedByRow,
    };
  }

  /**
   * List seat availability for a show
   * Returns available seats (not booked, not held by others)
   */
  async listAvailability(showId: string, query: SeatAvailabilityQueryDto) {
    const { userId } = query;

    // Get all show seats with their booking status
    const showSeats = await this.prisma.showSeat.findMany({
      where: { showId },
      include: {
        seat: true,
        bookings: {
          where: {
            booking: {
              status: { in: ['PENDING', 'CONFIRMED'] },
            },
          },
        },
        seatHolds: {
          where: {
            expiresAt: { gt: new Date() }, // Only active holds
          },
        },
      },
      orderBy: [{ seat: { row: 'asc' } }, { seat: { number: 'asc' } }],
    });

    // Map to availability status
    const availability = showSeats.map((showSeat) => {
      const isBooked = showSeat.bookings.length > 0;
      const activeHold = showSeat.seatHolds[0];
      const isHeldByOther = activeHold && activeHold.userId !== userId;
      const isHeldByMe = activeHold && activeHold.userId === userId;

      let status: 'available' | 'booked' | 'held' | 'held_by_me';
      if (isBooked) {
        status = 'booked';
      } else if (isHeldByMe) {
        status = 'held_by_me';
      } else if (isHeldByOther) {
        status = 'held';
      } else {
        status = 'available';
      }

      return {
        showSeatId: showSeat.id,
        seatId: showSeat.seat.id,
        row: showSeat.seat.row,
        number: showSeat.seat.number,
        price: showSeat.price,
        tier: showSeat.tier,
        status,
        holdExpiresAt: isHeldByMe ? activeHold?.expiresAt : undefined,
      };
    });

    // Summary counts
    const summary = {
      total: availability.length,
      available: availability.filter((s) => s.status === 'available').length,
      booked: availability.filter((s) => s.status === 'booked').length,
      held: availability.filter((s) => s.status === 'held').length,
      heldByMe: availability.filter((s) => s.status === 'held_by_me').length,
    };

    // Group by tier for pricing display
    const byTier = {
      REGULAR: availability.filter((s) => s.tier === 'REGULAR'),
      PREMIUM: availability.filter((s) => s.tier === 'PREMIUM'),
      VIP: availability.filter((s) => s.tier === 'VIP'),
    };

    // Group by row
    const byRow = availability.reduce(
      (acc, seat) => {
        if (!acc[seat.row]) {
          acc[seat.row] = [];
        }
        acc[seat.row].push(seat);
        return acc;
      },
      {} as Record<string, typeof availability>,
    );

    return {
      showId,
      summary,
      byTier,
      byRow,
      seats: availability,
    };
  }

  /**
   * Get only available seats for a show (for quick selection)
   */
  async getAvailableSeats(showId: string) {
    // Get IDs of seats that are booked (PENDING or CONFIRMED)
    const bookedSeatIds = await this.prisma.bookingSeat.findMany({
      where: {
        showSeat: { showId },
        booking: {
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      },
      select: { showSeatId: true },
    });

    // Get IDs of seats that have active holds
    const heldSeatIds = await this.prisma.seatHold.findMany({
      where: {
        showSeat: { showId },
        expiresAt: { gt: new Date() },
      },
      select: { showSeatId: true },
    });

    const unavailableIds = [
      ...bookedSeatIds.map((b) => b.showSeatId),
      ...heldSeatIds.map((h) => h.showSeatId),
    ];

    // Get available seats
    const availableSeats = await this.prisma.showSeat.findMany({
      where: {
        showId,
        id: { notIn: unavailableIds },
      },
      include: {
        seat: true,
      },
      orderBy: [{ seat: { row: 'asc' } }, { seat: { number: 'asc' } }],
    });

    return {
      showId,
      availableCount: availableSeats.length,
      seats: availableSeats.map((ss) => ({
        showSeatId: ss.id,
        row: ss.seat.row,
        number: ss.seat.number,
        price: ss.price,
        tier: ss.tier,
      })),
    };
  }
}
