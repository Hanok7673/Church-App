import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { loadConfig, type AppConfig } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { databasePlugin } from "./plugins/database.js";
import { authRoutes } from "./routes/auth.js";
import { membershipRoutes } from "./routes/memberships.js";

export async function buildApp(config: AppConfig = loadConfig()) {
  const app = Fastify({
    logger: config.NODE_ENV === "development" ? { transport: { target: "pino-pretty", options: { colorize: true } } } : true,
    trustProxy: true,
    bodyLimit: 1_000_000,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cors, { origin: config.MOBILE_ORIGIN, credentials: true });
  await app.register(databasePlugin, { config });
  await app.register(authPlugin, { config });

  app.get("/health", async () => ({ status: "ok", service: "church-api" }));
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(membershipRoutes, { prefix: "/v1" });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "NOT_FOUND", message: "Route not found." }));
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const postgresCode = (error as { code?: string }).code;
    if (postgresCode === "23505") return reply.code(409).send({ error: "CONFLICT", message: "This record already exists." });
    if (postgresCode === "23503") return reply.code(400).send({ error: "INVALID_REFERENCE", message: "A referenced record does not exist." });
    const statusCode = typeof error.statusCode === "number" && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : ((error as { code?: string }).code ?? "REQUEST_FAILED"),
      message: statusCode === 500 ? "An unexpected error occurred." : error.message,
    });
  });

  return app;
}
