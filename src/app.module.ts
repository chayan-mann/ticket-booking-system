import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./common/database/prisma.module";
import configuration from "./config/configurations";
import { ConfigModule } from "@nestjs/config";
import { MoviesModule } from "./modules/movies/movies.module";
import { TheatresModule } from "./modules/theatres/theatres.module";
import { ShowsModule } from "./modules/shows/shows.module";
import { SeatsModule } from "./modules/seats/seats.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { BookingExpiryCronService } from "./common/crons/booking-expiry.cron";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [configuration],
      expandVariables: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MoviesModule,
    TheatresModule,
    ShowsModule,
    SeatsModule,
    BookingsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService, BookingExpiryCronService],
})
export class AppModule {}
