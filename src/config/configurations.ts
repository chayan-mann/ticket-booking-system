import { registerAs } from "@nestjs/config";

export default registerAs('config', () => {
  return {
    port: process.env.PORT,
  };
});
