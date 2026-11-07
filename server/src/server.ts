import { env } from "./env";
import { buildApp } from "./app";

const app = buildApp();
await app.listen({ port: env.port, host: "0.0.0.0" });
