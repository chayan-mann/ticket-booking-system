import { Injectable } from "@nestjs/common";
import { CreateShowDto } from "./dto/create-show.dto";

@Injectable()
export class ShowsService {
  listShows(filter: { movieId?: string; theatreId?: string }) {
    // TODO: replace with Prisma query once DB is wired
    return { filter, items: [] };
  }

  getShow(id: string) {
    // TODO: replace with Prisma query once DB is wired
    return { id };
  }

  createShow(dto: CreateShowDto) {
    // TODO: replace with Prisma create once DB is wired
    return { id: "temp-show-id", ...dto };
  }
}
