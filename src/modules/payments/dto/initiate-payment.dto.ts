import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from "class-validator";

export class InitiatePaymentDto {
  @IsString()
  @MinLength(1)
  bookingId!: string;

  @IsString()
  @MinLength(1)
  userId!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  provider?: string;
}
