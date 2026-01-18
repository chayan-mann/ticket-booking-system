import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { MoviesService } from "./movies.service";
import { CreateMovieDto } from "./dto/create-movie.dto";
import { InternalServerErrorException } from "@nestjs/common";

@Controller("movies")
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get()
  listMovies() {
    try { 
      return this.moviesService.listMovies();
    } catch (error) {
      throw new InternalServerErrorException("Failed to list movies");
    }
  }

  @Get(":id")
  getMovie(@Param("id") id: string) {
    try {
      return this.moviesService.getMovie(id);
    } catch (error) {
      throw new InternalServerErrorException("Failed to get movie");
    }
  }

  @Post()
  createMovie(@Body() dto: CreateMovieDto) {
    try {
      return this.moviesService.createMovie(dto);
    } catch (error) {
      throw new InternalServerErrorException("Failed to create movie");
    }
  }
}
