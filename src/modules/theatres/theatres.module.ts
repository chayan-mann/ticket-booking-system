import { Module } from "@nestjs/common";
import { TheatresController } from "./theatres.controller";
import { TheatresService } from "./theatres.service";

@Module({
  controllers: [TheatresController],
  providers: [TheatresService],
  exports: [TheatresService],
})
export class TheatresModule {}
