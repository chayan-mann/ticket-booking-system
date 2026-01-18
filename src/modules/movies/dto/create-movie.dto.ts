import { IsInt, IsPositive, IsString, MinLength } from "class-validator";

export class CreateMovieDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsInt()
  @IsPositive()
  durationMin!: number;
}
