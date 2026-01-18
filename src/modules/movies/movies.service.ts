import { Injectable } from "@nestjs/common";
import { CreateMovieDto } from "./dto/create-movie.dto";
import { Movie } from "src/generated/prisma/client";
import { PrismaService } from "src/common/database/prisma.service";

@Injectable()
export class MoviesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMovies() {
    const movieList = await this.prisma.movie.findMany();
    return movieList
  }

  async getMovie(id: string) {
    const movie = await this.prisma.movie.findUnique({
      where: { id },
    });
    return movie;
  }

  async createMovie(dto: CreateMovieDto) {
    const movie = await this.prisma.movie.create({
      data: {
        title: dto.title,
        durationMin: dto.durationMin,
      },
    });
    return movie;
  }
}
