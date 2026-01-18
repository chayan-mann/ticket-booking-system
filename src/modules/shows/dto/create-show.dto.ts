import { IsDateString, IsString, MinLength } from "class-validator";

export class CreateShowDto {
  @IsString()
  @MinLength(1)
  movieId!: string;

  @IsString()
  @MinLength(1)
  screenId!: string;

  @IsDateString()
  startTime!: string;
}
