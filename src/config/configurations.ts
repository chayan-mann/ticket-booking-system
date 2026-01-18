import { registerAs } from "@nestjs/config";

export default registerAs("config", () => {
  return {
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
  };
});
