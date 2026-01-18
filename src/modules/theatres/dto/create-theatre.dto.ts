import { IsString, MinLength } from "class-validator";

export class CreateTheatreDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  city!: string;
}
