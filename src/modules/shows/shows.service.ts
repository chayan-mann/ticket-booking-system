import { Injectable } from "@nestjs/common";
import { CreateShowDto } from "./dto/create-show.dto";
import { PrismaService } from "src/common/database/prisma.service";
import { Show } from "src/generated/prisma/client";
import { InternalServerErrorException } from "@nestjs/common";

@Injectable()
export class ShowsService {
  constructor(private readonly prisma: PrismaService) {}

  async listShows(filter: { movieId?: string; screenId?: string }) {
    try {
    const showList = await this.prisma.show.findMany({
      where: {
        movieId: filter.movieId,
        screenId: filter.screenId,
      },
      include: {
        movie: true,
        screen: true,
        },
      });
      return showList;
    } catch (error) {
      throw new InternalServerErrorException("Failed to list shows");
      console.error(error);
    }
  }

  async getShow(id: string) {
    try { 
    const show = await this.prisma.show.findUnique({
      where: { id },
      include: {
        movie: true,
        screen: true,
      },
    });
    return show;
    } catch (error) {
      throw new InternalServerErrorException("Failed to get show");
      console.error(error);
    }
  }

  async createShow(dto: CreateShowDto) {
    try {
    const show = await this.prisma.show.create({
      data: {
        movieId: dto.movieId,
        screenId: dto.screenId,
        startTime: dto.startTime,
      },
    });
    return show;
    } catch (error) {
      throw new InternalServerErrorException("Failed to create show");
      console.error(error);
    }
  } 
}
