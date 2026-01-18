import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { TheatresService } from "./theatres.service";
import { CreateTheatreDto } from "./dto/create-theatre.dto";

@Controller("theatres")
export class TheatresController {
  constructor(private readonly theatresService: TheatresService) {}

  @Get()
  listTheatres() {
    return this.theatresService.listTheatres();
  }

  @Get(":id")
  getTheatre(@Param("id") id: string) {
    return this.theatresService.getTheatre(id);
  }

  @Post()
  createTheatre(@Body() dto: CreateTheatreDto) {
    return this.theatresService.createTheatre(dto);
  }
}
