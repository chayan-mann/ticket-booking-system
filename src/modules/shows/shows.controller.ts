import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ShowsService } from "./shows.service";
import { CreateShowDto } from "./dto/create-show.dto";

@Controller("shows")
export class ShowsController {
  constructor(private readonly showsService: ShowsService) {}

  @Get()
  listShows(
    @Query("movieId") movieId?: string,
    @Query("theatreId") theatreId?: string,
  ) {
    return this.showsService.listShows({ movieId, theatreId });
  }

  @Get(":id")
  getShow(@Param("id") id: string) {
    return this.showsService.getShow(id);
  }

  @Post()
  createShow(@Body() dto: CreateShowDto) {
    return this.showsService.createShow(dto);
  }
}
