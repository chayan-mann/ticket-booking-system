import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  showId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  seatIds!: string[];

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
