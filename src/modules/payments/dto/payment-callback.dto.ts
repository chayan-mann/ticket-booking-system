import { IsEnum, IsString, MinLength } from "class-validator";

export class PaymentCallbackDto {
  @IsString()
  @MinLength(1)
  reference!: string;

  @IsEnum(["SUCCESS", "FAILED"])
  status!: "SUCCESS" | "FAILED";
}
