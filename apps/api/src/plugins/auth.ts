import { memberships, platformRoles, users } from "@church/database";
import jwt from "@fastify/jwt";
import { and, eq, inArray } from "drizzle-orm";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";

export type AccessClaims = { sub: string; email: string; tokenVersion: number };

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessClaims;
    user: AccessClaims;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireChurchAdmin(userId: string, churchId: number): Promise<void>;
    requireChurchMember(userId: string, churchId: number): Promise<void>;
    requireSuperAdmin(userId: string): Promise<void>;
  }
}

export const authPlugin = fp<{ config: AppConfig }>(async (app, options) => {
  await app.register(jwt, { secret: options.config.JWT_SECRET, sign: { expiresIn: "15m" } });

  app.decorate("authenticate", async (request, reply) => {
    await request.jwtVerify();
    const [account] = await app.db.select({ tokenVersion: users.tokenVersion, status: users.status })
      .from(users).where(eq(users.id, request.user.sub)).limit(1);
    if (!account || account.status !== "active" || account.tokenVersion !== request.user.tokenVersion) {
      return reply.code(401).send({ error: "UNAUTHORIZED", message: "Your session is no longer valid." });
    }
  });

  app.decorate("requireChurchAdmin", async (userId, churchId) => {
    const [membership] = await app.db.select({ id: memberships.id }).from(memberships).where(and(
      eq(memberships.userId, userId), eq(memberships.churchId, churchId), eq(memberships.status, "active"),
      inArray(memberships.role, ["owner", "admin"]),
    )).limit(1);
    if (!membership) throw Object.assign(new Error("A church owner or administrator role is required."), { statusCode: 403, code: "FORBIDDEN" });
  });

  app.decorate("requireChurchMember", async (userId, churchId) => {
    const [membership] = await app.db.select({ id: memberships.id }).from(memberships).where(and(
      eq(memberships.userId, userId), eq(memberships.churchId, churchId), eq(memberships.status, "active"),
    )).limit(1);
    if (!membership) throw Object.assign(new Error("An active membership in this church is required."), { statusCode: 403, code: "FORBIDDEN" });
  });

  app.decorate("requireSuperAdmin", async (userId) => {
    const [role] = await app.db.select({ userId: platformRoles.userId }).from(platformRoles)
      .where(and(eq(platformRoles.userId, userId), eq(platformRoles.role, "super_admin"))).limit(1);
    if (!role) throw Object.assign(new Error("A platform super administrator role is required."), { statusCode: 403, code: "FORBIDDEN" });
  });
}, { name: "auth", dependencies: ["database"] });
