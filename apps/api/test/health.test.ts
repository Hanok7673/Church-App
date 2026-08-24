import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";

test("health endpoint identifies the Fastify service", async () => {
  const app = await buildApp({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: 4000,
    DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/church_app_test",
    JWT_SECRET: "test-only-secret-that-is-longer-than-thirty-two-characters",
    MOBILE_ORIGIN: "http://localhost:8081",
  });

  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok", service: "church-api" });
  } finally {
    await app.close();
  }
});
