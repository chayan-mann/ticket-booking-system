import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  app.setGlobalPrefix("api");

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Ticket Booking System API")
    .setDescription("API documentation for the Ticket Booking System")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Ticket Booking System API Docs",
    customfavIcon: "/favicon.ico",
    customCss: ".swagger-ui .topbar { display: none }",
  });

  const port = configService.get<number>("PORT", 8001);
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/api/v1/health`,
    "Bootstrap",
  );
  Logger.log(
    `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
    "Bootstrap",
  );
}
bootstrap();
