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

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  provider?: string;
}
