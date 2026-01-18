import { Injectable } from "@nestjs/common";
import { CreateTheatreDto } from "./dto/create-theatre.dto";

@Injectable()
export class TheatresService {
  listTheatres() {
    // TODO: replace with Prisma query once DB is wired
    return [];
  }

  getTheatre(id: string) {
    // TODO: replace with Prisma query once DB is wired
    return { id };
  }

  createTheatre(dto: CreateTheatreDto) {
    // TODO: replace with Prisma create once DB is wired
    return { id: "temp-theatre-id", ...dto };
  }
}
