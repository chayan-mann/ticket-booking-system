import { IsOptional, IsString } from "class-validator";

export class SeatAvailabilityQueryDto {
  @IsOptional()
  @IsString()
  from?: string;
}
