import { IsOptional, IsString } from "class-validator";

export class SeatAvailabilityQueryDto {
  @IsOptional()
  @IsString()
  userId?: string; // Pass to see your own seat holds

  @IsOptional()
  @IsString()
  from?: string; // Unused, kept for backwards compatibility
}
