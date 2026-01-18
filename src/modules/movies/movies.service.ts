import { Injectable } from "@nestjs/common";
import { CreateMovieDto } from "./dto/create-movie.dto";

@Injectable()
export class MoviesService {
  listMovies() {
    // TODO: replace with Prisma query once DB is wired
    return [];
  }

  getMovie(id: string) {
    // TODO: replace with Prisma query once DB is wired
    return { id };
  }

  createMovie(dto: CreateMovieDto) {
    // TODO: replace with Prisma create once DB is wired
    return { id: "temp-movie-id", ...dto };
  }
}
