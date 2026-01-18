import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { MoviesService } from "./movies.service";
import { CreateMovieDto } from "./dto/create-movie.dto";

@Controller("movies")
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get()
  listMovies() {
    return this.moviesService.listMovies();
  }

  @Get(":id")
  getMovie(@Param("id") id: string) {
    return this.moviesService.getMovie(id);
  }

  @Post()
  createMovie(@Body() dto: CreateMovieDto) {
    return this.moviesService.createMovie(dto);
  }
}
