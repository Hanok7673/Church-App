import * as schema from "@church/database";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import fp from "fastify-plugin";
import postgres, { type Sql } from "postgres";
import type { AppConfig } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>;
    sql: Sql;
  }
}

export const databasePlugin = fp<{ config: AppConfig }>(async (app, options) => {
  const client = postgres(options.config.DATABASE_URL, {
    max: options.config.NODE_ENV === "production" ? 20 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: options.config.NODE_ENV === "production" ? "require" : false,
  });

  app.decorate("sql", client);
  app.decorate("db", drizzle(client, { schema }));
  app.addHook("onClose", async () => client.end({ timeout: 5 }));
}, { name: "database" });
