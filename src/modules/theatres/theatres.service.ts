import { Injectable } from "@nestjs/common";
import { CreateTheatreDto } from "./dto/create-theatre.dto";
import { PrismaService } from "src/common/database/prisma.service";
import { Theatre } from "src/generated/prisma/client";
import { InternalServerErrorException } from "@nestjs/common";

@Injectable()
export class TheatresService {
  constructor(private readonly prisma: PrismaService) {}

  async listTheatres() {
    const theatreList = await this.prisma.theatre.findMany();
    return theatreList;
  }

  async getTheatre(id: string) {
    const theatre = await this.prisma.theatre.findUnique({
      where: { id },
    });
    return theatre;
  }

  async createTheatre(dto: CreateTheatreDto) {
    const theatre = await this.prisma.theatre.create({
      data: {
        name: dto.name,
        city: dto.city,
      },
    });
    return theatre;
  }
}
